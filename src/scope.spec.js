import Scope from './scope'

const noop = () => {}

describe('Scope', function () {
  let scope

  beforeEach(() => {
    scope = new Scope()
  })

  it('can be constructed and used as an object', () => {
    scope.aProperty = 1
    expect(scope.aProperty).toBe(1)
  })

  it('has a $$phase field whose value is the current digest phase', () => {
    scope.aValue = [1, 2, 3]
    scope.phaseInWatchFunction = undefined
    scope.phaseInListenerFunction = undefined
    scope.phaseInApplyFunction = undefined

    scope.$watch(
      (scope) => {
        scope.phaseInWatchFunction = scope.$$phase
        return scope.aValue
      },
      (newValue, oldValue, scope) => {
        scope.phaseInListenerFunction = scope.$$phase
      }
    )
    scope.$apply((scope) => {
      scope.phaseInApplyFunction = scope.$$phase
    })

    expect(scope.phaseInWatchFunction).toBe('$digest')
    expect(scope.phaseInListenerFunction).toBe('$digest')
    expect(scope.phaseInApplyFunction).toBe('$apply')
  })

  describe('$digest', () => {

    it('calls the watch function with the scope as the argument', () => {
      let watchFn = jasmine.createSpy('watchFn')
      let listenerFn = () => {}

      scope.$watch(watchFn, listenerFn)
      scope.$digest()

      expect(watchFn).toHaveBeenCalledWith(scope)
    })

    it('calls the listener function of a watch on first $digest', () => {
      let watchFn = () => 'change'
      let listenerFn = jasmine.createSpy('listenerFn')

      scope.$watch(watchFn, listenerFn)
      scope.$digest()

      expect(listenerFn).toHaveBeenCalled()
    })

    it('calls the listener function when the watched value changes', () => {
      scope.someValue = 'a'
      scope.counter = 0

      scope.$watch(
        (scope) => scope.someValue,
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
        (scope) => scope.someValue,
        (newValue, oldValue, scope) => { scope.counter++ }
      )
      scope.$digest()
      expect(scope.counter).toBe(1)
    })

    it('calls listener with new value as old value the first time', () => {
      scope.someValue = 123
      var oldValueGiven
      scope.$watch(
        (scope) => scope.someValue,
        (newValue, oldValue) => { oldValueGiven = oldValue }
      )
      scope.$digest()
      expect(oldValueGiven).toBe(123)
    })

    it('may have watchers that omit the listener function', () => {
      var watchFn = jasmine.createSpy('watchFn')
      scope.$watch(watchFn)
      scope.$digest()
      expect(watchFn).toHaveBeenCalled()
    })

    it('triggers chained watchers in the same digest', () => {
      scope.name = 'jane'

      scope.$watch(
        (scope) => scope.nameUpper,
        (newValue, oldValue, scope) => {
          if (newValue) {
            scope.initial = newValue.substring(0, 1) + '.'
          }
        }
      )

      scope.$watch(
        (scope) => scope.name,
        (newValue, oldValue, scope) => {
          if (newValue) {
            scope.nameUpper = newValue.toUpperCase()
          }
        }
      )

      scope.$digest()
      expect(scope.initial).toBe('J.')

      scope.name = 'bob'
      scope.$digest()
      expect(scope.initial).toBe('B.')
    })

    it('gives up on the watches after 10 iterations', () => {
      scope.counterA = 0
      scope.counterB = 0
    
      scope.$watch(
        (scope) => scope.counterA,
        (newValue, oldValue, scope) => { scope.counterB++ }
      )
    
      scope.$watch(
        (scope) => scope.counterB,
        (newValue, oldValue, scope) => { scope.counterA++ }
      )
    
      expect(() => { scope.$digest() }).toThrow()
    })

    it('ends the digest when the last watch is clean', () => {
      scope.array = [...Array(100)].map((_, i) => i)
      let watchExecutions = 0

      scope.array.forEach((_, i) => {
        scope.$watch(
          (scope) => {
            watchExecutions += 1
            return scope.array[i]
          }
        )
      })

      scope.$digest()
      expect(watchExecutions).toBe(200)

      scope.array[0] = 420
      scope.$digest()
      expect(watchExecutions).toBe(301)
    })

    it('does not end digest so that new watches are not run', () => {
      scope.aValue = 'abc'
      scope.counter = 0

      scope.$watch(
        (scope) => scope.aValue,
        (newValue, oldValue, scope) => {
          scope.$watch(
            (scope) => scope.aValue,
            (newValue, oldValue, scope) => {
              scope.counter++
            }
          )
        }
      )

      scope.$digest()
      expect(scope.counter).toBe(1)
    })

    it('compares based on value if enabled', () => {
      scope.aValue = [1, 2, 3]
      scope.counter = 0

      scope.$watch(
        (scope) => scope.aValue,
        (newValue, oldValue, scope) => {
          scope.counter++
        },
        true
      )

      scope.$digest()
      expect(scope.counter).toBe(1)

      scope.aValue.push(4)
      scope.$digest()
      expect(scope.counter).toBe(2)
    })

    it('correctly handles NaNs', () => {
      scope.number = 0 / 0  // NaN
      scope.counter = 0

      scope.$watch(
        (scope) => scope.number,
        (newValue, oldValue, scope) => {
          scope.counter++
        }
      )

      scope.$digest()
      expect(scope.counter).toBe(1)

      scope.$digest()
      expect(scope.counter).toBe(1)
    })

    it('catches exceptions in watch functions and continues', () => {
      scope.aValue = 'a'
      scope.counter = 0

      scope.$watch(
        (scope) => { throw 'Error' }
      )

      scope.$watch(
        (scope) => scope.aValue,
        (newValue, oldValue, scope) => {
          scope.counter++
        }
      )

      scope.$digest()
      expect(scope.counter).toBe(1)
    })

    it('catches exceptions in listener functions and continues', () => {
      scope.aValue = 'a'
      scope.counter = 0

      scope.$watch(
        (scope) => scope.aValue,
        (newValue, oldValue, scope) => {
          throw 'Error'
        }
      )

      scope.$watch(
        (scope) => scope.aValue,
        (newValue, oldValue, scope) => {
          scope.counter++
        }
      )

      scope.$digest()
      expect(scope.counter).toBe(1)
    })

    it('schedules a digest in $evalAsync', (done) => {
      scope.aValue = 'abc'
      scope.counter = 0

      scope.$watch(
        (scope) => scope.aValue,
        (newValue, oldValue, scope) => { scope.counter++ }
      )

      scope.$evalAsync((scope) => { })

      expect(scope.counter).toBe(0)

      setTimeout(() => {
        expect(scope.counter).toBe(1)
        done()
      }, 50)
    })

    it('eventually halts $evalAsyncs added by watches', () => {
      scope.aValue = [1, 2, 3]

      scope.$watch(
        (scope) => {
          scope.$evalAsync((scope) => { })
          return scope.aValue
        },
        (newValue, oldValue, scope) => { }
      )

      expect(() => { scope.$digest() }).toThrow()
    })

    it('executes $evalAsync\'ed function later in the same cycle', () => {
      scope.aValue = [1, 2, 3]
      scope.asyncEvaluated = false
      scope.asyncEvaluatedImmediately = false

      scope.$watch(
        (scope) => scope.aValue,
        (newValue, oldValue, scope) => {
          scope.$evalAsync((scope) => { scope.asyncEvaluated = true })
          scope.asyncEvaluatedImmediately = scope.asyncEvaluated
        }
      )

      scope.$digest()

      expect(scope.asyncEvaluated).toBe(true)
      expect(scope.asyncEvaluatedImmediately).toBe(false)
    })

    it('executes $evalAsync\'ed functions added by watch functions', () => {
      scope.aValue = [1, 2, 3]
      scope.asyncEvaluated = false

      scope.$watch(
        (scope) => {
          if (!scope.asyncEvaluated) {
            scope.$evalAsync((scope) => { scope.asyncEvaluated = true })
          }
          return scope.aValue
        },
        (newValue, oldValue, scope) => { }
      )

      scope.$digest()

      expect(scope.asyncEvaluated).toBe(true)
    })

    it('executes $evalAsync\'ed functions even when not dirty', () => {
      scope.aValue = [1, 2, 3]
      scope.asyncEvaluatedTimes = 0

      scope.$watch(
        (scope) => {
          if (scope.asyncEvaluatedTimes < 2) {
            scope.$evalAsync((scope) => { scope.asyncEvaluatedTimes++ })
          }
          return scope.aValue
        }
      )

      scope.$digest()

      expect(scope.asyncEvaluatedTimes).toBe(2)
    })

    it('handles exceptions thrown in $evalAsync\'ed functions', (done) => {
      scope.value = 'a'
      scope.counter = 0

      scope.$watch(
        (scope) => scope.value, 
        (newValue, oldValue, scope) => { scope.counter++ }
      )

      scope.$evalAsync((scope) => { throw 'Error' })

      setTimeout(() => {
        expect(scope.counter).toBe(1)
        done()
      }, 50)

    })

  })

  describe('$apply', () => {

    it('executes $apply\'ed function and starts the digest', () => {
      scope.aValue = 'someValue'
      scope.counter = 0

      scope.$watch(
        (scope) => scope.aValue,
        (newValue, oldValue, scope) => {
          scope.counter++
        }
      )

      scope.$digest()

      expect(scope.counter).toBe(1)
      scope.$apply(
        (scope) => { scope.aValue = 'someOtherValue' }
      )
      expect(scope.counter).toBe(2)
    })

    it('allows async $apply with $applyAsync', (done) => {
      scope.counter = 0
      scope.$watch(
        (scope) => scope.aValue,
        (newValue, oldValue, scope) => { scope.counter++ }
      )

      scope.$digest()
      expect(scope.counter).toBe(1)

      scope.$applyAsync((scope) => { scope.aValue = 'abc' })
      expect(scope.counter).toBe(1)

      setTimeout(() => {
        expect(scope.counter).toBe(2)
        done()
      }, 50)
    })

    it('never executes $applyAsynced function in the same cycle', (done) => {
      scope.aValue = [1, 2, 3]
      scope.asyncApplied = false

      scope.$watch(
        (scope) => scope.aValue,
        (newValue, oldValue, scope) => { 
          scope.$applyAsync((scope) => {
            scope.asyncApplied = true 
          })
        }
      )

      scope.$digest()
      expect(scope.asyncApplied).toBe(false)
      setTimeout(() => {
        expect(scope.asyncApplied).toBe(true)
        done()
      }, 50)

    })

    it('coalesces many calls to $applyAsync', (done) => {
      scope.counter = 0

      scope.$watch(
        (scope) => {
          scope.counter++
          return scope.aValue
        }
      )

      scope.$applyAsync((scope) => {
        scope.aValue = 'abc'
      })

      scope.$applyAsync((scope) => {
        scope.aValue = 'def'
      })

      setTimeout(() => {
        expect(scope.counter).toBe(2)
        done()
      }, 50)
    })

    it('cancels and flushes $applyAsync if digested first', (done) => {
      scope.counter = 0

      scope.$watch(
        (scope) => {
          scope.counter++
          return scope.aValue
        }
      )

      scope.$applyAsync((scope) => {
        scope.aValue = 'abc'
      })

      scope.$applyAsync((scope) => {
        scope.aValue = 'def'
      })

      scope.$digest()
      expect(scope.counter).toBe(2)
      expect(scope.aValue).toBe('def')

      setTimeout(() => {
        expect(scope.counter).toBe(2)
        done()
      }, 50)

    })

    it('$applyAsync handles exceptions', (done) => {
      scope.$applyAsync((scope) => {
        throw 'Error'  
      })

      scope.$applyAsync((scope) => {
        throw 'Error'  
      })

      scope.$applyAsync((scope) => {
        scope.applied = true  
      })

      setTimeout(() => {
        expect(scope.applied).toBe(true)
        done()
      }, 50)
    })

  })

  describe('$eval', () => {

    it('executes $eval\'ed function and returns result', () => {
      scope.aValue = 42
      var result = scope.$eval((scope) => scope.aValue)
      expect(result).toBe(42)
    })

    it('passes the second $eval argument straight through', () => {
      scope.aValue = 42
      var result = scope.$eval((scope, arg) => scope.aValue + arg, 2)
      expect(result).toBe(44)
    })

  })

  describe('$watch', () => {

    it('returns a function with which to remove the watcher', () => {
      expect(scope.$$watchers.length).toBe(0)

      const removeFn = scope.$watch()
      expect(scope.$$watchers.length).toBe(1)

      removeFn()
      expect(scope.$$watchers.length).toBe(0)
    })

    it('allows destroying a $watch during digest', () => {
      scope.aValue = 'abc'
      const watchCalls = []

      scope.$watch(
        (scope) => { 
          watchCalls.push('first')
          return scope.aValue
        }
      )

      var destroyWatch = scope.$watch(
        (scope) => {
          watchCalls.push('second')
          destroyWatch()
        }
      )

      scope.$watch(
        (scope) => {
          watchCalls.push('third')
          return scope.aValue
        }
      )
      
      scope.$digest()
      expect(watchCalls).toEqual([
        'first', 'second', 'third', 'first', 'third',
      ])
    })

    it('allows a $watch to destroy another during digest', () => {
      scope.aValue = 'abc'
      scope.counter = 0

      scope.$watch(
        (scope) => scope.aValue,
        (newValue, oldValue, scope) => {
          removeWatch()
        }
      )

      const removeWatch = scope.$watch()

      scope.$watch(
        (scope) => scope.aValue,
        (newValue, oldValue, scope) => {
          scope.counter++
        }
      )

      scope.$digest()
      expect(scope.counter).toBe(1)
    })

    it('allows destroying several $watches during digest', () => {
      scope.aValue = 'abc'
      scope.counter = 0

      const removeWatch = scope.$watch(
        (scope) => scope.aValue,
        (newValue, oldValue, scope) => {
          removeWatch()
          removeWatch2()
        }
      )

      const removeWatch2 = scope.$watch(
        (scope) => scope.aValue,
        (newValue, oldValue, scope) => {
          scope.counter++
        }
      )

      scope.$digest()
      expect(scope.counter).toBe(0)
    })

  })

  describe('$$postWatch', () => {

    it('runs once after next digest', () => {
      scope.counter = 0

      scope.$$postDigest(() => {
        scope.counter++
      })

      expect(scope.counter).toBe(0)

      scope.$digest()
      expect(scope.counter).toBe(1)

      scope.$digest()
      expect(scope.counter).toBe(1)
    })

    it('is not included in the digest', () => {
      scope.value = 'original'

      scope.$$postDigest(() => {
        scope.value = 'changed'
      })

      scope.$watch(
        (scope) => scope.value,
        (newValue, oldValue, scope) => {
          scope.watchedValue = newValue
        }
      )

      scope.$digest()
      expect(scope.watchedValue).toBe('original')

      scope.$digest()
      expect(scope.watchedValue).toBe('changed')
    })

    it('handles expections', () => {
      let didRun = false

      scope.$$postDigest(() => {
        throw 'Error'
      })

      scope.$$postDigest(() => {
        didRun = true
      })

      scope.$digest()
      expect(didRun).toBe(true)
    })

  })

  describe('$watchGroup', () => {

    it('takes watches as and array and call listener with arrays', () => {
      let newVals
      let oldVals
      scope.values = [1, 2, 3]

      scope.$watchGroup([
          (scope) => scope.values[0],
          (scope) => scope.values[1],
          (scope) => scope.values[2],
        ],
        (newValues, oldValues, scope) => {
          newVals = newValues
          oldVals = oldValues
        }
      )

      scope.$digest()
      expect(scope.values).toEqual(newVals)
      expect(scope.values).toEqual(oldVals)
    })

    it('calls listener only once per digest', () => {
      scope.values = [1, 2]
      scope.counter = 0

      scope.$watchGroup([
          (scope) => scope.values[0],
          (scope) => scope.values[1],
        ],
        (newValues, oldValues, scope) => {
          scope.counter++
        }
      )

      scope.$digest()
      expect(scope.counter).toEqual(1)
    })

    it('uses the same array of new and old values on the first run', () => {
      let gotNewValues
      let gotOldValues

      scope.aValue = 1
      scope.anotherValue = 2

      scope.$watchGroup([
          (scope) => scope.aValue,
          (scope) => scope.anotherValue,
        ],
        (newValues, oldValues, scope) => {
          gotNewValues = newValues
          gotOldValues = oldValues
        }
      )

      scope.$digest()
      expect(gotOldValues).toBe(gotNewValues)
    })

    it('uses different arrays of new and old values on subseq runs', () => {
      let gotNewValues
      let gotOldValues

      scope.aValue = 1
      scope.anotherValue = 2

      scope.$watchGroup([
          (scope) => scope.aValue,
          (scope) => scope.anotherValue,
        ],
        (newValues, oldValues, scope) => {
          gotNewValues = newValues
          gotOldValues = oldValues
        }
      )

      scope.$digest()

      scope.anotherValue = 3
      scope.$digest()

      expect(gotNewValues).toEqual([1, 3])
      expect(gotOldValues).toEqual([1, 2])
    })

    it('calls the listener once when the watch array is empty', () => {
      scope.counter = 0

      scope.$watchGroup([],
        (newValues, oldValues, scope) => {
          scope.counter++
        }
      )

      scope.$digest()
      
      expect(scope.counter).toEqual(1)
    })

    it('can be deregistered', () => {
      scope.aValue = 'a'
      scope.anotherValue = 'b'
      scope.counter = 0

      const remove = scope.$watchGroup([
          (scope) => scope.aValue,
          (scope) => scope.anotherValue,
        ],
        (newValues, oldValues, scope) => {
          scope.counter++
        }
      )

      scope.$digest()
      
      remove()
      scope.$digest()

      expect(scope.counter).toEqual(1)
    })

    it('does not call zero-watch listener when deregistered first ', () => {
      scope.counter = 0

      const remove = scope.$watchGroup([],
        (newValues, oldValues, scope) => {
          scope.counter++
        }
      )
      
      remove()
      scope.$digest()

      expect(scope.counter).toEqual(0)
    })

  })

  describe('inheritance', () => {

    it('inherits the parent\'s properties', () => {
      scope.aValue = [1, 2, 3]
      const child = scope.$new()

      expect(child.aValue).toEqual([1, 2, 3])
    })

    it('does not cause a parent to inherit its properties', () => {
      const child = scope.$new()
      child.aValue = [1, 2, 3]

      expect(scope.aValue).toBeUndefined()
    })

    it('inherits the parents properties whenever they are defined', () => {
      const child = scope.$new()
      scope.aValue = [1, 2, 3]

      expect(child.aValue).toEqual([1, 2, 3])
    })
    
    it('can manipulate a parent scope\'s property', () => {
      scope.aValue = [1, 2, 3]
      const child = scope.$new()
      child.aValue.push(4)

      expect(scope.aValue).toEqual([1, 2, 3, 4])
      expect(child.aValue).toEqual([1, 2, 3, 4])
    })

    it('can watch a property in the parent', () => {
      const child = scope.$new()
      scope.aValue = [1, 2, 3]
      child.counter = 0

      child.$watch(
        (scope) => scope.aValue,
        (newValue, oldValue, scope) => { scope.counter++ },
        true
      ) 

      child.$digest()

      expect(child.counter).toBe(1)

      scope.aValue.push(4)
      child.$digest()

      expect(child.counter).toBe(2)
    })

    it('can be nested at any depth', () => {
      const a   = new Scope()
      const aa  = a.$new()
      const aaa = aa.$new()
      const aab = aa.$new()
      const ab  = a.$new()
      const abb = ab.$new()

      a.value = 1

      expect(aa.value).toBe(1)
      expect(aaa.value).toBe(1)
      expect(aab.value).toBe(1)
      expect(ab.value).toBe(1)
      expect(abb.value).toBe(1)

      ab.anotherValue = 2

      expect(abb.anotherValue).toBe(2)
      expect(a.anotherValue).toBeUndefined()
      expect(aa.anotherValue).toBeUndefined()
      expect(aaa.anotherValue).toBeUndefined()
    })

    it('shadows a parent\'s property with the same name', () => {
      const child  = scope.$new()

      scope.name = 'jim'
      child.name = 'jill'

      expect(scope.name).toBe('jim')
      expect(child.name).toBe('jill')
    })

    it('does not shadow members of parent scope\'s attributes', () => {
      const child  = scope.$new()

      // the dot rule
      scope.user = { name: 'jim' }
      child.user.name = 'jill'

      expect(scope.user.name).toBe('jill')
      expect(child.user.name).toBe('jill')
    })

    it('does not digest its parent(s)', () => {
      const child = scope.$new()
      
      scope.value = 'a'
      scope.$watch(
        (scope) => scope.value,
        (newValue, oldValue, scope) => {
          scope.valueWas = newValue
        }
      )

      child.$digest()

      expect(child.valueWas).toBeUndefined()
    })

    it('keeps a record of its children', () => {
      const child1 = scope.$new()
      const child2 = scope.$new()
      const child1a = child1.$new()

      expect(scope.$$children.length).toBe(2)
      expect(child1.$$children.length).toBe(1)
      expect(child2.$$children.length).toBe(0)
      expect(child1a.$$children.length).toBe(0)

      expect(scope.$$children[0]).toBe(child1)
      expect(scope.$$children[1]).toBe(child2)
      expect(child1.$$children[0]).toBe(child1a)
    })

    it('digests its children', () => {
      const child = scope.$new()
      scope.aValue = 'a'

      child.$watch(
        (scope) => scope.aValue,
        (newValue, oldValue, scope) => {
          scope.gotNewValue = newValue
        }
      )

      scope.$digest()

      expect(child.gotNewValue).toBe('a')
    })

    it('digests from root on $apply', () => {
      const child = scope.$new()
      const child2 = scope.$new()

      scope.aValue = 'a'
      scope.counter = 0

      scope.$watch(
        (scope) => scope.aValue,
        (newValue, oldValue, scope) => { scope.counter++ }
      )

      child2.$apply(noop)
      expect(scope.counter).toBe(1)
    })

    it('schedules a digest from root on $evalAsync', (done) => {
      const child = scope.$new()
      const child2 = scope.$new()

      scope.aValue = 'a'
      scope.counter = 0

      scope.$watch(
        (scope) => scope.aValue,
        (newValue, oldValue, scope) => { scope.counter++ }
      )

      child2.$evalAsync(noop)

      setTimeout(() => {
        expect(scope.counter).toBe(1)
        done()
      }, 50)
    })  

    describe('isolated scope', () => {

      it('does not inherit the parent\'s attributes', () => {
        scope.aValue = [1, 2, 3]
        const child = scope.$new(true)

        expect(child.aValue).toBeUndefined()
      })
      
      it('cannot watch parent\'s attributes', () => {
        scope.aValue = 'a'
        const child = scope.$new(true)

        child.$watch(
          (scope) => scope.aValue,
          (newValue, oldValue, scope) => {
            child.valueWas = newValue
          }
        )

        child.$digest()
        expect(child.valueWas).toBeUndefined()

        expect(child.aValue).toBeUndefined()
      })

      it('digests its isolated children', () => {
        const child = scope.$new(true)

        child.aValue = 'a'
        child.$watch(
          (scope) => scope.aValue,
          (newValue, oldValue, scope) => {
            scope.gotNewValue = newValue
          }
        )

        scope.$digest()

        expect(child.gotNewValue).toBe('a')
      })

    })

  })

})
