import { getStorageItem, setStorageItem, removeStorageItem, clearStorage } from '../storage'

describe('storage utilities', () => {
  let storage: Map<string, string>

  beforeEach(() => {
    storage = new Map()
  })

  describe('getStorageItem', () => {
    it('retrieves and parses JSON data', () => {
      const data = { name: 'test', version: '1.0.0' }
      storage.set('key', JSON.stringify(data))

      const result = getStorageItem(storage, 'key')
      expect(result).toEqual(data)
    })

    it('returns null if key does not exist', () => {
      const result = getStorageItem(storage, 'nonexistent')
      expect(result).toBeNull()
    })

    it('returns default value if key does not exist', () => {
      const defaultValue = { default: true }
      const result = getStorageItem(storage, 'nonexistent', defaultValue)
      expect(result).toEqual(defaultValue)
    })

    it('returns default value on parse error', () => {
      storage.set('invalid', 'not valid json {')
      const result = getStorageItem(storage, 'invalid', null)
      expect(result).toBeNull()
    })

    it('handles empty string', () => {
      storage.set('empty', '')
      const result = getStorageItem(storage, 'empty', null)
      expect(result).toBeNull()
    })

    it('parses complex objects', () => {
      const complex = {
        nested: { deep: { value: 123 } },
        array: [1, 2, 3],
        bool: true,
      }
      storage.set('complex', JSON.stringify(complex))

      const result = getStorageItem(storage, 'complex')
      expect(result).toEqual(complex)
    })

    it('parses arrays', () => {
      const arr = ['a', 'b', 'c']
      storage.set('array', JSON.stringify(arr))

      const result = getStorageItem<string[]>(storage, 'array', [])
      expect(result).toEqual(arr)
    })

    it('returns empty array as default', () => {
      const result = getStorageItem<string[]>(storage, 'missing', [])
      expect(result).toEqual([])
    })
  })

  describe('setStorageItem', () => {
    it('serializes and stores data', () => {
      const data = { name: 'test' }
      const success = setStorageItem(storage, 'key', data)

      expect(success).toBe(true)
      expect(storage.get('key')).toBe(JSON.stringify(data))
    })

    it('stores primitives', () => {
      setStorageItem(storage, 'string', 'value')
      setStorageItem(storage, 'number', 42)
      setStorageItem(storage, 'boolean', true)

      expect(storage.get('string')).toBe('"value"')
      expect(storage.get('number')).toBe('42')
      expect(storage.get('boolean')).toBe('true')
    })

    it('stores arrays', () => {
      const arr = [1, 2, 3]
      setStorageItem(storage, 'array', arr)

      expect(storage.get('array')).toBe('[1,2,3]')
    })

    it('stores null', () => {
      setStorageItem(storage, 'null', null)
      expect(storage.get('null')).toBe('null')
    })

    it('overwrites existing values', () => {
      setStorageItem(storage, 'key', 'first')
      setStorageItem(storage, 'key', 'second')

      expect(getStorageItem(storage, 'key')).toBe('second')
    })

    it('handles complex nested objects', () => {
      const complex = {
        a: { b: { c: [1, 2, 3] } },
        d: 'test',
      }
      setStorageItem(storage, 'complex', complex)

      const retrieved = getStorageItem(storage, 'complex')
      expect(retrieved).toEqual(complex)
    })
  })

  describe('removeStorageItem', () => {
    it('removes item from storage', () => {
      storage.set('key', 'value')
      expect(storage.has('key')).toBe(true)

      removeStorageItem(storage, 'key')
      expect(storage.has('key')).toBe(false)
    })

    it('handles removing nonexistent key', () => {
      expect(() => removeStorageItem(storage, 'nonexistent')).not.toThrow()
    })

    it('removes correct key among multiple', () => {
      storage.set('key1', 'value1')
      storage.set('key2', 'value2')
      storage.set('key3', 'value3')

      removeStorageItem(storage, 'key2')

      expect(storage.has('key1')).toBe(true)
      expect(storage.has('key2')).toBe(false)
      expect(storage.has('key3')).toBe(true)
    })
  })

  describe('clearStorage', () => {
    it('clears all items from storage', () => {
      storage.set('key1', 'value1')
      storage.set('key2', 'value2')
      storage.set('key3', 'value3')

      clearStorage(storage)

      expect(storage.size).toBe(0)
      expect(storage.has('key1')).toBe(false)
      expect(storage.has('key2')).toBe(false)
      expect(storage.has('key3')).toBe(false)
    })

    it('handles empty storage', () => {
      expect(() => clearStorage(storage)).not.toThrow()
      expect(storage.size).toBe(0)
    })

    it('allows adding items after clear', () => {
      storage.set('old', 'value')
      clearStorage(storage)

      storage.set('new', 'value')
      expect(storage.get('new')).toBe('value')
      expect(storage.has('old')).toBe(false)
    })
  })

  describe('integration', () => {
    it('supports full workflow', () => {
      // Set multiple items
      setStorageItem(storage, 'item1', { id: 1 })
      setStorageItem(storage, 'item2', { id: 2 })
      setStorageItem(storage, 'item3', { id: 3 })

      // Retrieve items
      expect(getStorageItem(storage, 'item1')).toEqual({ id: 1 })
      expect(getStorageItem(storage, 'item2')).toEqual({ id: 2 })

      // Remove one item
      removeStorageItem(storage, 'item2')
      expect(getStorageItem(storage, 'item2')).toBeNull()

      // Other items still exist
      expect(getStorageItem(storage, 'item1')).toEqual({ id: 1 })
      expect(getStorageItem(storage, 'item3')).toEqual({ id: 3 })

      // Clear all
      clearStorage(storage)
      expect(getStorageItem(storage, 'item1')).toBeNull()
      expect(getStorageItem(storage, 'item3')).toBeNull()
    })
  })
})
