import { renderHook } from '@testing-library/react';

import { useCountries } from '@/ui/input/components/internal/hooks/useCountries';

describe('useCountries', () => {
  it('uses the searchable English name Turkey for the TR country code', () => {
    const { result } = renderHook(() => useCountries());

    expect(
      result.current.find(({ countryCode }) => countryCode === 'TR')
        ?.countryName,
    ).toBe('Turkey');
  });
});
