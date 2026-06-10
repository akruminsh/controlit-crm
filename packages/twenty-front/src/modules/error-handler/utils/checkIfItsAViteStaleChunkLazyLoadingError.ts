const STALE_CHUNK_RELOAD_STORAGE_KEY = 'twenty-stale-chunk-reloaded-at';

const STALE_CHUNK_RELOAD_THROTTLE_IN_MS = 10_000;

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return '';
};

export const checkIfItsAViteStaleChunkLazyLoadingError = (error: unknown) => {
  const errorMessage = getErrorMessage(error).toLowerCase();

  return [
    'failed to fetch dynamically imported module',
    'error loading dynamically imported module',
    'importing a module script failed',
    'unable to preload css for',
  ].some((staleChunkErrorMessage) =>
    errorMessage.includes(staleChunkErrorMessage),
  );
};

type ReloadPageOnViteStaleChunkLazyLoadingErrorOptions = {
  now?: () => number;
  reloadPage?: () => void;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
};

export const reloadPageOnViteStaleChunkLazyLoadingError = (
  error: unknown,
  {
    now = () => Date.now(),
    reloadPage = () => window.location.reload(),
    storage = window.sessionStorage,
  }: ReloadPageOnViteStaleChunkLazyLoadingErrorOptions = {},
) => {
  if (!checkIfItsAViteStaleChunkLazyLoadingError(error)) {
    return false;
  }

  const storedLastReloadAt = storage.getItem(STALE_CHUNK_RELOAD_STORAGE_KEY);
  const lastReloadAt =
    storedLastReloadAt === null ? null : Number(storedLastReloadAt);
  const currentTime = now();

  if (
    lastReloadAt !== null &&
    currentTime - lastReloadAt < STALE_CHUNK_RELOAD_THROTTLE_IN_MS
  ) {
    return true;
  }

  storage.setItem(STALE_CHUNK_RELOAD_STORAGE_KEY, String(currentTime));
  reloadPage();

  return true;
};
