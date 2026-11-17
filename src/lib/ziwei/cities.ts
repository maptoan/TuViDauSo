export interface CityInfo {
  name: string;
  longitude: number; // degrees East
  utcOffsetMinutes?: number; // 420 for Vietnam (UTC+7), 480 for China (UTC+8)
}

export interface ProvinceInfo {
  name: string;
  utcOffsetMinutes?: number;
  cities: CityInfo[];
}

export const PROVINCES: ProvinceInfo[] = [
  // ─── Việt Nam (Múi giờ UTC+7 · Kinh tuyến chuẩn 105°E) ─────────────────────
  {
    name: 'Việt Nam — Miền Bắc',
    utcOffsetMinutes: 420,
    cities: [
      { name: 'Hà Nội', longitude: 105.85, utcOffsetMinutes: 420 },
      { name: 'Hải Phòng', longitude: 106.68, utcOffsetMinutes: 420 },
      { name: 'Quảng Ninh (Hạ Long)', longitude: 107.08, utcOffsetMinutes: 420 },
      { name: 'Bắc Ninh', longitude: 106.07, utcOffsetMinutes: 420 },
      { name: 'Hải Dương', longitude: 106.33, utcOffsetMinutes: 420 },
      { name: 'Hưng Yên', longitude: 106.05, utcOffsetMinutes: 420 },
      { name: 'Vĩnh Phúc (Vĩnh Yên)', longitude: 105.60, utcOffsetMinutes: 420 },
      { name: 'Thái Nguyên', longitude: 105.84, utcOffsetMinutes: 420 },
      { name: 'Bắc Giang', longitude: 106.19, utcOffsetMinutes: 420 },
      { name: 'Phú Thọ (Việt Trì)', longitude: 105.40, utcOffsetMinutes: 420 },
      { name: 'Nam Định', longitude: 106.17, utcOffsetMinutes: 420 },
      { name: 'Thái Bình', longitude: 106.34, utcOffsetMinutes: 420 },
      { name: 'Ninh Bình', longitude: 105.97, utcOffsetMinutes: 420 },
      { name: 'Hà Nam (Phủ Lý)', longitude: 105.91, utcOffsetMinutes: 420 },
      { name: 'Lào Cai (Sa Pa)', longitude: 103.97, utcOffsetMinutes: 420 },
      { name: 'Yên Bái', longitude: 104.87, utcOffsetMinutes: 420 },
      { name: 'Tuyên Quang', longitude: 105.21, utcOffsetMinutes: 420 },
      { name: 'Hà Giang', longitude: 104.98, utcOffsetMinutes: 420 },
      { name: 'Cao Bằng', longitude: 106.26, utcOffsetMinutes: 420 },
      { name: 'Bắc Kạn', longitude: 105.83, utcOffsetMinutes: 420 },
      { name: 'Lạng Sơn', longitude: 106.76, utcOffsetMinutes: 420 },
      { name: 'Sơn La', longitude: 103.91, utcOffsetMinutes: 420 },
      { name: 'Điện Biên Phủ', longitude: 103.02, utcOffsetMinutes: 420 },
      { name: 'Lai Châu', longitude: 103.46, utcOffsetMinutes: 420 },
      { name: 'Hòa Bình', longitude: 105.34, utcOffsetMinutes: 420 },
    ],
  },
  {
    name: 'Việt Nam — Miền Trung & Tây Nguyên',
    utcOffsetMinutes: 420,
    cities: [
      { name: 'Đà Nẵng', longitude: 108.22, utcOffsetMinutes: 420 },
      { name: 'Thừa Thiên Huế', longitude: 107.59, utcOffsetMinutes: 420 },
      { name: 'Thanh Hóa', longitude: 105.78, utcOffsetMinutes: 420 },
      { name: 'Nghệ An (Vinh)', longitude: 105.68, utcOffsetMinutes: 420 },
      { name: 'Hà Tĩnh', longitude: 105.90, utcOffsetMinutes: 420 },
      { name: 'Quảng Bình (Đồng Hới)', longitude: 106.62, utcOffsetMinutes: 420 },
      { name: 'Quảng Trị (Đông Hà)', longitude: 107.10, utcOffsetMinutes: 420 },
      { name: 'Quảng Nam (Tam Kỳ / Hội An)', longitude: 108.47, utcOffsetMinutes: 420 },
      { name: 'Quảng Ngãi', longitude: 108.80, utcOffsetMinutes: 420 },
      { name: 'Bình Định (Quy Nhơn)', longitude: 109.22, utcOffsetMinutes: 420 },
      { name: 'Phú Yên (Tuy Hòa)', longitude: 109.30, utcOffsetMinutes: 420 },
      { name: 'Khánh Hòa (Nha Trang)', longitude: 109.19, utcOffsetMinutes: 420 },
      { name: 'Ninh Thuận (Phan Rang)', longitude: 108.99, utcOffsetMinutes: 420 },
      { name: 'Bình Thuận (Phan Thiết)', longitude: 108.10, utcOffsetMinutes: 420 },
      { name: 'Lâm Đồng (Đà Lạt)', longitude: 108.44, utcOffsetMinutes: 420 },
      { name: 'Đắk Lắk (Buôn Ma Thuột)', longitude: 108.04, utcOffsetMinutes: 420 },
      { name: 'Gia Lai (Pleiku)', longitude: 108.00, utcOffsetMinutes: 420 },
      { name: 'Kon Tum', longitude: 108.00, utcOffsetMinutes: 420 },
      { name: 'Đắk Nông (Gia Nghĩa)', longitude: 107.69, utcOffsetMinutes: 420 },
    ],
  },
  {
    name: 'Việt Nam — Miền Nam & ĐBSCL',
    utcOffsetMinutes: 420,
    cities: [
      { name: 'TP. Hồ Chí Minh (Sài Gòn)', longitude: 106.70, utcOffsetMinutes: 420 },
      { name: 'Cần Thơ', longitude: 105.78, utcOffsetMinutes: 420 },
      { name: 'Bình Dương (Thủ Dầu Một)', longitude: 106.65, utcOffsetMinutes: 420 },
      { name: 'Đồng Nai (Biên Hòa)', longitude: 106.82, utcOffsetMinutes: 420 },
      { name: 'Bà Rịa - Vũng Tàu', longitude: 107.08, utcOffsetMinutes: 420 },
      { name: 'Tây Ninh', longitude: 106.10, utcOffsetMinutes: 420 },
      { name: 'Bình Phước (Đồng Xoài)', longitude: 106.89, utcOffsetMinutes: 420 },
      { name: 'Long An (Tân An)', longitude: 106.41, utcOffsetMinutes: 420 },
      { name: 'Tiền Giang (Mỹ Tho)', longitude: 106.36, utcOffsetMinutes: 420 },
      { name: 'Bến Tre', longitude: 106.38, utcOffsetMinutes: 420 },
      { name: 'Vĩnh Long', longitude: 105.97, utcOffsetMinutes: 420 },
      { name: 'Trà Vinh', longitude: 106.34, utcOffsetMinutes: 420 },
      { name: 'Đồng Tháp (Cao Lãnh)', longitude: 105.63, utcOffsetMinutes: 420 },
      { name: 'An Giang (Long Xuyên)', longitude: 105.44, utcOffsetMinutes: 420 },
      { name: 'Kiên Giang (Rạch Giá / Phú Quốc)', longitude: 105.08, utcOffsetMinutes: 420 },
      { name: 'Hậu Giang (Vị Thanh)', longitude: 105.47, utcOffsetMinutes: 420 },
      { name: 'Sóc Trăng', longitude: 105.97, utcOffsetMinutes: 420 },
      { name: 'Bạc Liêu', longitude: 105.72, utcOffsetMinutes: 420 },
      { name: 'Cà Mau', longitude: 105.15, utcOffsetMinutes: 420 },
    ],
  },
];
