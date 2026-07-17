import { CONTROLIT_TERRITORIES } from 'src/modules/controlit/territory-access/constants/controlit-territory.constants';

describe('Controlit territories', () => {
  it('supports Turkey as an assignable territory', () => {
    expect(CONTROLIT_TERRITORIES).toContain('TURKEY');
  });
});
