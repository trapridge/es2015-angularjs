const noop = () => {}
function initialValue() {} // represents a non-set watchable

export default class Scope {

  constructor(timeToLive = 10) {
    this.$$timeToLive = timeToLive
    this.$$watchers = []
    this.$$lastDirtyWatcher = null
    this.$$asyncQueue = []
    this.$$applyAsyncQueue = []
    this.$$applyAsyncId = null
    this.$$phase = null
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
        this.$apply(() => {
          while (this.$$applyAsyncQueue.length) {
            this.$$applyAsyncQueue.shift()()   
          }
          this.$$applyAsyncId = null
        })
      }, 0)
    }
  }

  $eval(expr, locals) {
    return expr(this, locals)
  }

  // attempts to schedule invocation in ongoing digest cycle 
  $evalAsync(expr) {
    if (!this.$$phase && this.$$asyncQueue.length === 0) {
      setTimeout(() => {
        if (this.$$asyncQueue.length > 0) {
          this.$digest()
        }
      }, 0)
    }

    this.$$asyncQueue.push({ scope: this, expr })
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

    do {
      this.$$processEvalAsyncQueue()
      stillDirty = this.$$digestOnce()

      if ((stillDirty || this.$$asyncQueue.length > 0) &&
            ttlCounter > this.$$timeToLive) {
        this.$clearPhase()
        throw {
          name: 'DigestIterationException',
          message: `${this.$$timeToLive} digest iterations exceeded`,
        }
      }

      ttlCounter += 1
    }
    while (stillDirty || this.$$asyncQueue.length > 0)
    this.$clearPhase()
  }

  $$processEvalAsyncQueue() {
    while (this.$$asyncQueue.length > 0) {
      const asyncTask = this.$$asyncQueue.shift()
      asyncTask.scope.$eval(asyncTask.expr)
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
