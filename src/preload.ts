// Полифиллы для Node.js < 22.
// @opencode/client использует возможности, появившиеся в Node 20/22:
// - Promise.withResolvers (Node 22)
// - Array.prototype.toSorted / toReversed / toSpliced / with (Node 20)
//
// Полифиллы нужны только для запуска на старых версиях Node.
// Рекомендуется обновить Node.js до 22 LTS.

type PromiseWithResolvers = <T>() => {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}

const promiseCtor = Promise as unknown as {
  withResolvers?: PromiseWithResolvers
}

if (typeof promiseCtor.withResolvers !== 'function') {
  promiseCtor.withResolvers = function withResolvers<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: unknown) => void

    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })

    return { promise, resolve, reject }
  }
}

const arrayProto = Array.prototype as unknown as Record<string, unknown>

function defineArrayMethod(name: string, value: unknown) {
  if (typeof arrayProto[name] === 'function') return
  Object.defineProperty(arrayProto, name, {
    value,
    writable: true,
    configurable: true,
    enumerable: false,
  })
}

defineArrayMethod('toSorted', function toSorted<T>(
  this: T[],
  compareFn?: (a: T, b: T) => number,
): T[] {
  return [...this].sort(compareFn)
})

defineArrayMethod('toReversed', function toReversed<T>(this: T[]): T[] {
  return [...this].reverse()
})

defineArrayMethod('toSpliced', function toSpliced<T>(
  this: T[],
  start: number,
  deleteCount?: number,
  ...items: T[]
): T[] {
  const copy = [...this]
  if (deleteCount === undefined) {
    copy.splice(start)
  } else {
    copy.splice(start, deleteCount, ...items)
  }
  return copy
})

defineArrayMethod('with', function withIndex<T>(
  this: T[],
  index: number,
  value: T,
): T[] {
  const copy = [...this]
  const normalized = index < 0 ? copy.length + index : index
  copy[normalized] = value
  return copy
})
