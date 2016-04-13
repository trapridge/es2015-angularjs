import Scope from './scope'

describe('Scope', function () {
  it('can be constructed and used as an object', () => {
    var scope = new Scope()
    scope.aProperty = 1
    expect(scope.aProperty).toBe(1)
  })
})
