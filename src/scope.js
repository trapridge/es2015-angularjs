function initialValue() {} // represents a non-set watchable

export default class Scope {
  constructor() {
    this.$$watchers = []
  }

  $watch(watchFn, listenerFn = () => {}) {
    const watcher = { watchFn, listenerFn, lastValue: initialValue }
    this.$$watchers.push(watcher)

    // return function to remove the watcher
    return () => {
      const index = this.$$watchers.indexOf(watcher)
      this.$$watchers.splice(index, 1)
    }
  }

  $digest() {
    let newValue
    let oldValue

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
      }
    })
  }
}
