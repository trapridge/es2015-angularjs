import Scope from './scope'

describe('Scope', function () {

  it('can be constructed and used as an object', () => {
    var scope = new Scope()
    scope.aProperty = 1
    expect(scope.aProperty).toBe(1)
  })

  describe('$digest', () => {
    let scope

    beforeEach(() => {
      scope = new Scope()
    })

    it('calls the listener function of a watch on first $digest', () => {
      let watchFn = () => 'change'
      let listenerFn = jasmine.createSpy('listenerFn')

      scope.$watch(watchFn, listenerFn)
      scope.$digest()

      expect(listenerFn).toHaveBeenCalled()
    })

    it('calls the watch function with the scope as the argument', () => {
      let watchFn = jasmine.createSpy('watchFn')
      let listenerFn = () => {}

      scope.$watch(watchFn, listenerFn)
      scope.$digest()

      expect(watchFn).toHaveBeenCalledWith(scope)
    })

    it('calls the listener function when the watched value changes', () => {
      scope.someValue = 'a'
      scope.counter = 0

      scope.$watch(
        scope => scope.someValue,
        (newValue, oldValue, scope) => { scope.counter++ }
      )

      expect(scope.counter).toBe(0)

      scope.$digest()
      expect(scope.counter).toBe(1)

      scope.$digest()
      expect(scope.counter).toBe(1)

      scope.someValue = 'b'
      expect(scope.counter).toBe(1)

      scope.$digest()
      expect(scope.counter).toBe(2)
    })

    it('calls listener when watch value is first undefined', () => {
      scope.counter = 0
      scope.$watch(
        scope => scope.someValue,
        (newValue, oldValue, scope) => { scope.counter++ }
      )
      scope.$digest()
      expect(scope.counter).toBe(1)
    })

    it('calls listener with new value as old value the first time', () => {
      scope.someValue = 123
      var oldValueGiven
      scope.$watch(
        scope => scope.someValue,
        (newValue, oldValue, scope) => { oldValueGiven = oldValue }
      )
      scope.$digest()
      expect(oldValueGiven).toBe(123)
    })

    it('may have watchers that omit the listener function', () => {
      var watchFn = jasmine.createSpy('watchFn').and.returnValue('1')
      scope.$watch(watchFn)
      scope.$digest()
      expect(watchFn).toHaveBeenCalled()
    })

  })

  describe('$watch', () => {

    it('returns a function with which to remove the watcher', () => {
      const scope = new Scope()

      expect(scope.$$watchers.length).toBe(0)

      const removeFn = scope.$watch(() => {}, () => {})
      expect(scope.$$watchers.length).toBe(1)

      removeFn()
      expect(scope.$$watchers.length).toBe(0)
    })

  })

})
