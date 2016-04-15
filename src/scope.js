function initialValue() {} // represents a non-set watchable

export default class Scope {
  constructor(timeToLive = 10) {
    this.$$timeToLive = timeToLive
    this.$$watchers = []
    this.$$lastDirtyWatcher = null
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

    // return function to remove the watcher
    return () => {
      const index = this.$$watchers.indexOf(watcher)
      this.$$watchers.splice(index, 1)
    }
  }

  $digest() {
    let ttlCounter = 1
    let stillDirty
    this.$$lastDirtyWatcher = null

    do {
      stillDirty = this.$$digestOnce()

      if (stillDirty && ttlCounter > this.$$timeToLive) {
        throw {
          name: 'DigestIterationException',
          message: `${this.$$timeToLive + 1} digest iterations reached`,
        }
      }

      ttlCounter += 1
    }
    while (stillDirty)
  }

  $$digestOnce() {
    let newValue
    let oldValue
    let wasDirty = false

    this.$$watchers.every(watcher => {
      newValue = watcher.watchFn(this)
      oldValue = watcher.lastValue

      // dirty checking
      if (!this.$$areEqual(newValue, oldValue, watcher.valueEq)) {
        this.$$lastDirtyWatcher = watcher
        watcher.lastValue = watcher.valueEq ?
                              this.$$deepCopy(newValue) : newValue
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

  $$areEqual(newVal, oldVal, valueEq) {
    if (valueEq) {
      return JSON.stringify(newVal) === JSON.stringify(oldVal)
    }
    return this.$$areNaNEqual(newVal, oldVal) || newVal === oldVal
  }

  $$areNaNEqual(newVal, oldVal) {
    return (typeof newVal === 'number' &&
            typeof oldVal === 'number' &&
            isNaN(newVal) &&
            isNaN(oldVal))
  }

  $$deepCopy(source) {
    return JSON.parse(JSON.stringify(source))
  }

}
