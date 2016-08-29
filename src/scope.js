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
  }

  $apply(expr) {
    this.$beginPhase('$apply')
    try {
      this.$eval(expr)
    } finally {
      this.$clearPhase()
      this.$digest()
    }
  }

  // always defers the invocation to future digest cycle
  $applyAsync(expr) {
    this.$$applyAsyncQueue.push(() => { this.$eval(expr) })
    if (this.$$applyAsyncId === null) {
      this.$$applyAsyncId = setTimeout(() => {
        this.$apply(this.$$flushApplyAsyncQueue.bind(this))
      }, 0)
    }
  }

  $$flushApplyAsyncQueue() {
    while (this.$$applyAsyncQueue.length) {
      try {
        this.$$applyAsyncQueue.shift()()   
      } catch (e) {
        // console.error(e)
      }
    }
    this.$$applyAsyncId = null
  }

  $eval(expr, locals) {
    return expr(this, locals)
  }

  // attempts to schedule invocation in ongoing digest cycle 
  $evalAsync(expr) {
    if (!this.$$phase && this.$$evalAsyncQueue.length === 0) {
      setTimeout(() => {
        if (this.$$evalAsyncQueue.length > 0) {
          this.$digest()
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
    this.$$lastDirtyWatcher = null

    return () => {
      const index = this.$$watchers.indexOf(watcher)
      if (index > -1) {
        this.$$watchers.splice(index, 1)
        this.$$lastDirtyWatcher = null
      }
    }
  }

  $digest() {
    let ttlCounter = 1
    let stillDirty
    this.$$lastDirtyWatcher = null
    this.$beginPhase('$digest')

    if (this.$$applyAsyncId) {
      clearTimeout(this.$$applyAsyncId)
      this.$$flushApplyAsyncQueue()
    }

    do {
      this.$$processEvalAsyncQueue()
      stillDirty = this.$$digestOnce()

      if ((stillDirty || this.$$evalAsyncQueue.length > 0) &&
            ttlCounter > this.$$timeToLive) {
        this.$clearPhase()
        throw {
          name: 'DigestIterationException',
          message: `${this.$$timeToLive} digest iterations exceeded`,
        }
      }

      ttlCounter += 1
    }
    while (stillDirty || this.$$evalAsyncQueue.length > 0)
    this.$clearPhase()
    this.$$flushPostDigestQueue()
  }

  $$flushPostDigestQueue() {
    while (this.$$postDigestQueue.length) {
      try {
        this.$$postDigestQueue.shift()()
      } catch (e) {
        // console.error(e)
      }
    }
  }

  $$processEvalAsyncQueue() {
    while (this.$$evalAsyncQueue.length) {
      const asyncTask = this.$$evalAsyncQueue.shift()
      try {
        asyncTask.scope.$eval(asyncTask.expr)
      } catch (e) {
        // console.error(e)
      }
    }
  }

  $$digestOnce() {
    let newValue
    let oldValue
    let wasDirty = false

    for (let i = this.$$watchers.length - 1; i >= 0; i--) {
      const watcher = this.$$watchers[i]
      if (watcher) {
        try {
          newValue = watcher.watchFn(this)
          oldValue = watcher.lastValue

          // dirty checking
          if (!Scope.$$areEqual(newValue, oldValue, watcher.valueEq)) {
            this.$$lastDirtyWatcher = watcher
            watcher.lastValue = watcher.valueEq ?
                                  Scope.$$deepCopy(newValue) : newValue
            watcher.listenerFn(
              newValue,
              oldValue === initialValue ? newValue : oldValue,
              this
            )
            wasDirty = true
          } else if (watcher === this.$$lastDirtyWatcher) {
            // short-circuit out as rest of the watches are clean
            return false
          }
        } catch (e) {
          // console.error(e)
        }
      }    
    }
    return wasDirty
  }

  $beginPhase(phase) {
    if (this.$$phase) {
      throw {
        name: 'PhaseException',
        message: `${this.$$phase} already in progress`,
      }
    }
    this.$$phase = phase
  }

  $clearPhase() {
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

}
