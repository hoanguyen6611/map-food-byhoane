import { DISTRICT_FROM_ADDRESS_REGEX, districtCondition, slugifyArea } from './area.util';

describe('slugifyArea', () => {
  it('strips accents and đ', () => {
    expect(slugifyArea('Bình Thạnh')).toBe('binh-thanh');
    expect(slugifyArea('Quận 3')).toBe('quan-3');
    expect(slugifyArea('Thành phố Thủ Đức')).toBe('thanh-pho-thu-duc');
  });
});

describe('district parsing from full address', () => {
  const extract = (text: string) => text.match(new RegExp(DISTRICT_FROM_ADDRESS_REGEX))?.[1]?.trim() ?? null;

  it('pulls the old district out of a post-reform address', () => {
    expect(extract('184/28 Lý Chính Thắng, Quận 3, Hồ Chí Minh 95000, Việt Nam')).toBe('Quận 3');
    expect(extract('12 Phan Văn Trị, Quận Bình Thạnh, TP.HCM')).toBe('Quận Bình Thạnh');
  });

  it('does not treat the province "Thành phố Hồ Chí Minh" as a district', () => {
    expect(extract('150 Hoa Lan, Phường Cầu Kiệu, Thành phố Hồ Chí Minh')).toBeNull();
  });
});

describe('districtCondition', () => {
  // Same regex Postgres receives (~* is case-insensitive).
  const patternOf = (d: string) => {
    const sql = districtCondition(d);
    return new RegExp(sql.values[1] as string, 'i');
  };

  it('matches the district as its own address part', () => {
    expect(patternOf('Quận 1').test('10 Lê Lợi, Quận 1, Hồ Chí Minh')).toBe(true);
  });

  it('does not match a longer district that starts the same', () => {
    expect(patternOf('Quận 1').test('10 Ba Tháng Hai, Quận 10, Hồ Chí Minh')).toBe(false);
  });
});
