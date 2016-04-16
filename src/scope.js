function initialValue() {} // represents a non-set watchable

export default class Scope {

  constructor(timeToLive = 10) {
    this.$$timeToLive = timeToLive
    this.$$watchers = []
    this.$$lastDirtyWatcher = null
    this.$$asyncQueue = []
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

  $applyAsync() {
    // page 69
  }

  $eval(expr, locals) {
    return expr(this, locals)
  }

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

  $watch(watchFn = () => {}, listenerFn = () => {}, valueEq = false) {
    const watcher = {
      watchFn,
      listenerFn,
      valueEq,
      lastValue: initialValue,
    }
    this.$$watchers.push(watcher)
    this.$$lastDirtyWatcher = null

    return () => {
      const index = this.$$watchers.indexOf(watcher)
      this.$$watchers.splice(index, 1)
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

    this.$$watchers.every((watcher) => {
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
        return false
      }

      return true
    })

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
