const noop = () => {}
function initialValue() {} // represents a non-set watchable

export default class Scope {

  constructor(timeToLive = 10) {
    this.$$timeToLive = timeToLive
    this.$$watchers = []
    this.$$lastDirtyWatcher = null
    this.$$evalAsyncQueue = []
    this.$$applyAsyncQueue = []
    this.$$applyAsyncId = null
    this.$$phase = null
    this.$$postDigestQueue = []
    this.$$children = []
    this.$$root = this
  }

  $new(isolated = false) {
    let childScope
    if (isolated) {
      childScope = new Scope()
    } else {
      childScope = Object.create(this)  // with prototype
    }

    childScope.$$watchers = []
    childScope.$$children = []
    this.$$children.push(childScope)
    
    return childScope
  }

  $apply(expr) {
    this.$$beginPhase('$apply')
    try {
      this.$eval(expr)
    } finally {
      this.$$clearPhase()
      this.$$root.$digest()
    }
  }

  $applyAsync(expr) {
    // always defers the invocation to future digest cycle
    this.$$applyAsyncQueue.push(() => { this.$eval(expr) })
    if (this.$$applyAsyncId === null) {
      this.$$applyAsyncId = setTimeout(() => {
        this.$apply(this.$$flushApplyAsyncQueue.bind(this))
      }, 0)
    }
  }

  $eval(expr, locals) {
    return expr(this, locals)
  }

  $evalAsync(expr) {
    // attempts to schedule invocation in ongoing digest cycle 
    if (!this.$$phase && this.$$evalAsyncQueue.length === 0) {
      setTimeout(() => {
        if (this.$$evalAsyncQueue.length > 0) {
          this.$$root.$digest()
        }
      }, 0)
    }

    this.$$evalAsyncQueue.push({ scope: this, expr })
  }

  $watchGroup(watchFns = [], listenerFn = noop) {
    const oldValues = new Array(watchFns.length)
    const newValues = new Array(watchFns.length)
    let changeReactionScheduled = false
    let firstRun = true

    // listener is called once even if no watches in group
    if (!watchFns.length) {
      var shouldCall = true
      this.$evalAsync(() => {
        if (shouldCall) {
          listenerFn(newValues, oldValues, this)
        }
      })
      return () => {
        shouldCall = false
      }
    }

    const callWatchGroupListener = () => {
      if (firstRun) {
        firstRun = false
        listenerFn(newValues, newValues, this)
      } else {
        listenerFn(newValues, oldValues, this)
      }
      changeReactionScheduled = false
    }

    // jscs:disable requireShorthandArrowFunctions
    let removeFns = watchFns.map((watchFn, i) => {
      return this.$watch(watchFn, (newValue, oldValue) => {
        newValues[i] = newValue
        oldValues[i] = oldValue
        if (!changeReactionScheduled) {
          changeReactionScheduled = true
          this.$evalAsync(callWatchGroupListener)
        }
      })
    })
    // jscs: enable requireShorthandArrowFunctions

    return () => {
      removeFns.forEach((removeFn) => {
        removeFn()
      })
    }
  }

  $watch(watchFn = noop, listenerFn = noop, valueEq = false) {
    const watcher = {
      watchFn,
      listenerFn,
      valueEq,
      lastValue: initialValue,
    }
    this.$$watchers.unshift(watcher)
    this.$$root.$$lastDirtyWatcher = null

    return () => {
      const index = this.$$watchers.indexOf(watcher)
      if (index > -1) {
        this.$$watchers.splice(index, 1)
        this.$$root.$$lastDirtyWatcher = null
      }
    }
  }

  $digest() {
    let ttlCounter = 1
    let stillDirty
    this.$$root.$$lastDirtyWatcher = null
    this.$$beginPhase('$digest')

    if (this.$$applyAsyncId) {
      clearTimeout(this.$$applyAsyncId)
      this.$$flushApplyAsyncQueue()
    }

    do {
      this.$$flushEvalAsyncQueue()
      stillDirty = this.$$digestOnce()

      if ((stillDirty || this.$$evalAsyncQueue.length > 0) &&
            ttlCounter > this.$$timeToLive) {
        this.$$clearPhase()
        throw {
          name: 'DigestIterationException',
          message: `${this.$$timeToLive} digest iterations exceeded`,
        }
      }

      ttlCounter += 1
    }
    while (stillDirty || this.$$evalAsyncQueue.length > 0)
    this.$$clearPhase()
    this.$$flushPostDigestQueue()
  }

  $$flushApplyAsyncQueue() {
    while (this.$$applyAsyncQueue.length) {
      try {
        this.$$applyAsyncQueue.shift()()   
      } catch (e) {
        Scope.$$logError(e)
      }
    }
    this.$$applyAsyncId = null
  }

  $$flushEvalAsyncQueue() {
    while (this.$$evalAsyncQueue.length) {
      const asyncTask = this.$$evalAsyncQueue.shift()
      try {
        asyncTask.scope.$eval(asyncTask.expr)
      } catch (e) {
        Scope.$$logError(e)
      }
    }
  }

  $$flushPostDigestQueue() {
    while (this.$$postDigestQueue.length) {
      try {
        this.$$postDigestQueue.shift()()
      } catch (e) {
        Scope.$$logError(e)
      }
    }
  }

  $$digestOnce() {
    let wasDirty = false
    let continueLoop = true

    this.$$everyScope((scope) => {
      let newValue
      let oldValue
      for (let i = scope.$$watchers.length - 1; i >= 0; i--) {
        const watcher = scope.$$watchers[i]
        if (watcher) {
          try {
            newValue = watcher.watchFn(scope)
            oldValue = watcher.lastValue

            // dirty checking
            if (!Scope.$$areEqual(newValue, oldValue, watcher.valueEq)) {
              this.$$root.$$lastDirtyWatcher = watcher
              watcher.lastValue = watcher.valueEq ?
                                    Scope.$$deepCopy(newValue) : newValue
              watcher.listenerFn(
                newValue,
                oldValue === initialValue ? newValue : oldValue,
                scope
              )
              wasDirty = true
            } else if (watcher === this.$$root.$$lastDirtyWatcher) {
              // short-circuit out as rest of the watches are clean
              continueLoop = false
              return false
            }
          } catch (e) {
            Scope.$$logError(e)
          }
        }
      }
      return continueLoop
    })
    return wasDirty
  }

  $$everyScope(fn) {
    if (fn(this)) this.$$children.every((child) => child.$$everyScope(fn))
    else return false
  }

  $$beginPhase(phase) {
    if (this.$$phase) {
      throw {
        name: 'PhaseException',
        message: `${this.$$phase} already in progress`,
      }
    }
    this.$$phase = phase
  }

  $$clearPhase() {
    this.$$phase = null
  }

  $$postDigest(fn) {
    this.$$postDigestQueue.push(fn)
  }

  static $$areEqual(newVal, oldVal, valueEq) {
    if (valueEq) {
      return JSON.stringify(newVal) === JSON.stringify(oldVal)
    }
    return Scope.$$areNaNEqual(newVal, oldVal) || newVal === oldVal
  }

  static $$areNaNEqual(newVal, oldVal) {
    return (typeof newVal === 'number' && typeof oldVal === 'number' &&
            isNaN(newVal) && isNaN(oldVal))
  }

  static $$deepCopy(source) {
    return JSON.parse(JSON.stringify(source))
  }

  static $$logError(message) {
    // console.error(message)
  }

}
