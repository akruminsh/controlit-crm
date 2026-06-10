import {
  checkIfItsAViteStaleChunkLazyLoadingError,
  reloadPageOnViteStaleChunkLazyLoadingError,
} from '@/error-handler/utils/checkIfItsAViteStaleChunkLazyLoadingError';

describe('checkIfItsAViteStaleChunkLazyLoadingError', () => {
  it('should return true when error message contains the Vite stale chunk error text', () => {
    const error = new Error(
      'Failed to fetch dynamically imported module: /some/module.js',
    );

    const result = checkIfItsAViteStaleChunkLazyLoadingError(error);

    expect(result).toBe(true);
  });

  it('should return false when error message does not contain the Vite stale chunk error text', () => {
    const error = new Error('Some other error message');

    const result = checkIfItsAViteStaleChunkLazyLoadingError(error);

    expect(result).toBe(false);
  });

  it('should reload the page once when a stale Vite chunk lazy loading error occurs', () => {
    const reloadPage = jest.fn();
    const storage = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    } as Storage;

    const error = new Error(
      'Failed to fetch dynamically imported module: /assets/WorkspaceSectionListDndKit-old.js',
    );

    const firstResult = reloadPageOnViteStaleChunkLazyLoadingError(error, {
      now: () => 1000,
      reloadPage,
      storage: mockStorage,
    });
    const secondResult = reloadPageOnViteStaleChunkLazyLoadingError(error, {
      now: () => 2000,
      reloadPage,
      storage: mockStorage,
    });

    expect(firstResult).toBe(true);
    expect(secondResult).toBe(true);
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });
});
