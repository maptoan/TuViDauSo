/**
 * Cơ sở dữ liệu Lá Số Danh Nhân
 * Dựa trên tư liệu ngày giờ sinh công khai và khảo cứu mệnh lý cổ điển
 */

export interface FamousPerson {
  id: string;
  name: string;
  nameEn: string;
  category: 'Thương Nghiệp' | 'Văn Nghệ' | 'Lịch Sử' | 'Thể Thao' | 'Công Nghệ';
  description: string;
  descriptionEn: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  gender: 'male' | 'female';
  notable: string;
  notableEn: string;
}

export const FAMOUS_PERSONS: FamousPerson[] = [
  {
    id: 'ma-yun',
    name: 'Mã Vân (Jack Ma)',
    nameEn: 'Jack Ma',
    category: 'Thương Nghiệp',
    description: 'Nhà sáng lập Tập đoàn Alibaba',
    descriptionEn: 'Founder of Alibaba',
    year: 1964, month: 9, day: 10, hour: 5,
    gender: 'male',
    notable: 'Lá số thể hiện sức mạnh phá cách lập tân rất lớn; hệ sao tại cung Quan Lộc tương ứng chặt chẽ với cơ nghiệp thương mại điện tử.',
    notableEn: 'The chart shows an exceptional ability to break established patterns and rebuild, while the Career Palace closely parallels the rise of an internet business empire.',
  },
  {
    id: 'li-jiacheng',
    name: 'Lý Gia Thành',
    nameEn: 'Li Ka-shing',
    category: 'Thương Nghiệp',
    description: 'Tỷ phú Hồng Kông · Nhà sáng lập Tập đoàn Trường Hòa',
    descriptionEn: 'Hong Kong billionaire and founder of the CK Hutchison business empire',
    year: 1928, month: 7, day: 29, hour: 3,
    gender: 'male',
    notable: 'Tứ Hóa tại cung Tài Bạch là trường hợp kinh điển khi nghiên cứu mệnh bàn đại phú phương Đông: Lộc Tồn thủ Tài, tích lũy ngày càng dày.',
    notableEn: 'The Four Transformations in the Wealth Palace make this a compelling case study of extraordinary wealth; Lu Cun preserves assets and supports steady accumulation.',
  },
  {
    id: 'ren-zhengfei',
    name: 'Nhậm Chính Phi',
    nameEn: 'Ren Zhengfei',
    category: 'Thương Nghiệp',
    description: 'Nhà sáng lập Tập đoàn Huawei',
    descriptionEn: 'Founder of Huawei',
    year: 1944, month: 10, day: 25, hour: 3,
    gender: 'male',
    notable: 'Cách cục Thất Sát nhập Mệnh điển hình — cả đời lội ngược dòng gió, càng gặp áp lực càng kiên cường phát triển.',
    notableEn: 'Qi Sha in the Life Palace points to a life strengthened by adversity—the greater the pressure, the stronger the response—making this a vivid case study of traditional Qi Sha theory.',
  },
  {
    id: 'zhang-ailing',
    name: 'Trương Ái Linh',
    nameEn: 'Eileen Chang',
    category: 'Văn Nghệ',
    description: 'Nữ văn sĩ kiệt xuất của văn học cận hiện đại',
    descriptionEn: 'A master of modern Chinese literature',
    year: 1920, month: 9, day: 30, hour: 1,
    gender: 'female',
    notable: 'Tổ hợp sao cô khắc và văn tinh trên mệnh bàn phản ánh sâu sắc cuộc đời tình cảm nhiều thăng trầm cùng văn nghiệp bất hủ.',
    notableEn: 'The chart’s combination of solitary stars forms a striking parallel with her celebrated romantic history and literary achievements.',
  },
  {
    id: 'jay-chou',
    name: 'Châu Kiệt Luân (Jay Chou)',
    nameEn: 'Jay Chou',
    category: 'Văn Nghệ',
    description: 'Nhạc sĩ, ca sĩ và biểu tượng âm nhạc đương đại',
    descriptionEn: 'Mandopop singer-songwriter and cultural icon',
    year: 1979, month: 1, day: 18, hour: 1,
    gender: 'male',
    notable: 'Tổ hợp Văn Khúc hội Tham Lang mang thiên phú nghệ thuật bẩm sinh, lý giải khả năng sáng tạo giao thoa giữa cổ điển và hiện đại.',
    notableEn: 'The combination of Wen Qu and Tan Lang suggests natural artistic talent and helps explain his ability to move across musical styles.',
  },
  {
    id: 'wang-fei',
    name: 'Vương Phi (Faye Wong)',
    nameEn: 'Faye Wong',
    category: 'Văn Nghệ',
    description: 'Danh ca huyền thoại của làng nhạc Á Đông',
    descriptionEn: 'One of the most iconic singers in Chinese pop',
    year: 1969, month: 8, day: 8, hour: 4,
    gender: 'female',
    notable: 'Tinh tượng cung Phu Thê và cung Phúc Đức phản ánh rõ nét khí chất tự tại cùng hành trình tình duyên đầy cá tính.',
    notableEn: 'The stars in the Marriage Palace closely parallel her two high-profile marriages, making the relationship pattern especially valuable for study.',
  },
  {
    id: 'lin-zhiling',
    name: 'Lâm Chí Linh',
    nameEn: 'Lin Chi-ling',
    category: 'Văn Nghệ',
    description: 'Người mẫu, diễn viên và nhà hoạt động thiện nguyện',
    descriptionEn: 'Taiwanese model and actress',
    year: 1974, month: 11, day: 29, hour: 5,
    gender: 'female',
    notable: 'Hình mẫu điển hình của cách cục Thái Âm thủ Mệnh ở nữ mệnh — khí chất dịu dàng, thanh nhã và giàu lòng nhân ái.',
    notableEn: 'Tai Yin guarding the Life Palace is a classic symbol of feminine grace, closely echoing the traditional view that this placement bestows exceptional beauty.',
  },
  {
    id: 'steve-jobs',
    name: 'Steve Jobs',
    nameEn: 'Steve Jobs',
    category: 'Công Nghệ',
    description: 'Đồng sáng lập Tập đoàn Apple',
    descriptionEn: 'Co-founder of Apple',
    year: 1955, month: 2, day: 24, hour: 6,
    gender: 'male',
    notable: 'Cách cục Phá Quân nhập Mệnh điển hình — phá cựu lập tân, trải qua biến cố lớn rồi kiến tạo đế chế công nghệ thay đổi thế giới.',
    notableEn: 'Po Jun in the Life Palace, adoption at birth, and the creation of the Apple empire make this an archetypal chart of renewal after disruption.',
  },
  {
    id: 'elon-musk',
    name: 'Elon Musk',
    nameEn: 'Elon Musk',
    category: 'Công Nghệ',
    description: 'Nhà sáng lập SpaceX · CEO Tesla',
    descriptionEn: 'Founder of SpaceX and CEO of Tesla',
    year: 1971, month: 6, day: 28, hour: 4,
    gender: 'male',
    notable: 'Biểu hiện mãnh liệt của cách cục Sát Phá Lang hội Thiên Mã — không ngừng mở rộng biên giới công nghệ và không gian của nhân loại.',
    notableEn: 'An intense expression of the Sha Po Lang pattern, with a powerful Travel Horse star and a life devoted to pushing the boundaries of humanity’s future.',
  },
  {
    id: 'yao-ming',
    name: 'Diêu Minh (Yao Ming)',
    nameEn: 'Yao Ming',
    category: 'Thể Thao',
    description: 'Huyền thoại bóng rổ NBA',
    descriptionEn: 'Legendary NBA center and ambassador for Chinese basketball',
    year: 1980, month: 9, day: 12, hour: 5,
    gender: 'male',
    notable: 'Thiên Lương thủ Mệnh tạo nên phong thái điềm đạm, uy nghi; cung Quan Lộc và Thiên Di tương ứng với sự nghiệp vươn tầm quốc tế.',
    notableEn: 'Tian Liang guarding the Life Palace suggests stature and dignity, while the Career Palace closely aligns with his professional achievements.',
  },
  {
    id: 'li-na',
    name: 'Lý Na (Li Na)',
    nameEn: 'Li Na',
    category: 'Thể Thao',
    description: 'Nhà vô địch quần vợt Grand Slam châu Á',
    descriptionEn: 'Chinese Grand Slam tennis champion',
    year: 1982, month: 2, day: 26, hour: 2,
    gender: 'female',
    notable: 'Thất Sát tọa Mệnh mang ý chí thi đấu kiên cường; vận trình Đại Hạn và Lưu Niên ứng nghiệm rõ với cột mốc đăng quang Roland Garros.',
    notableEn: 'Qi Sha channels a powerful competitive drive, while the major periods and annual cycles closely align with the timing of her French Open victory.',
  },
];

export function getFamousByCategory(category: FamousPerson['category']): FamousPerson[] {
  return FAMOUS_PERSONS.filter(p => p.category === category);
}

export const FAMOUS_CATEGORIES: FamousPerson['category'][] = [
  'Thương Nghiệp', 'Văn Nghệ', 'Công Nghệ', 'Thể Thao',
];
