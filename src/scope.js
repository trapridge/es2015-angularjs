function initialValue() {} // represents a non-set watchable

export default class Scope {
  constructor() {
    this.$$watchers = []
  }

  $watch(watchFn = () => {}, listenerFn = () => {}) {
    const watcher = { watchFn, listenerFn, lastValue: initialValue }
    this.$$watchers.push(watcher)

    // return function to remove the watcher
    return () => {
      const index = this.$$watchers.indexOf(watcher)
      this.$$watchers.splice(index, 1)
    }
  }

  $digest() {
    let stillDirty
    do {
      stillDirty = this._digestOnce()
    }
    while (stillDirty)
  }

  _digestOnce() {
    let newValue
    let oldValue
    let dirty = false

    this.$$watchers.forEach(watcher => {
      newValue = watcher.watchFn(this)
      oldValue = watcher.lastValue

      if (newValue !== oldValue) {  // dirty checking
        watcher.lastValue = newValue
        watcher.listenerFn(
          newValue,
          oldValue === initialValue ? newValue : oldValue,
          this
        )
        dirty = true
      }
    })

    return dirty
  }
}
