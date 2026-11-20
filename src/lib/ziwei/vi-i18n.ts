import type { Pattern } from './patterns';
import type { ZiweiChart, Palace } from './types';

// ─── 1. Thiên Can & Địa Chi (Heavenly Stems & Earthly Branches) ─────────────
export const VI_STEMS = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
export const VI_BRANCHES = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];

export const CN_TO_VI_STEM: Record<string, string> = {
  '甲': 'Giáp', '乙': 'Ất', '丙': 'Bính', '丁': 'Đinh', '戊': 'Mậu',
  '己': 'Kỷ', '庚': 'Canh', '辛': 'Tân', '壬': 'Nhâm', '癸': 'Quý',
};

export const CN_TO_VI_BRANCH: Record<string, string> = {
  '子': 'Tý', '丑': 'Sửu', '寅': 'Dần', '卯': 'Mão', '辰': 'Thìn', '巳': 'Tỵ',
  '午': 'Ngọ', '未': 'Mùi', '申': 'Thân', '酉': 'Dậu', '戌': 'Tuất', '亥': 'Hợi',
};

export const VI_SHICHEN = [
  { branch: 0, name: 'Giờ Tý', range: '23:00–01:00' },
  { branch: 1, name: 'Giờ Sửu', range: '01:00–03:00' },
  { branch: 2, name: 'Giờ Dần', range: '03:00–05:00' },
  { branch: 3, name: 'Giờ Mão', range: '05:00–07:00' },
  { branch: 4, name: 'Giờ Thìn', range: '07:00–09:00' },
  { branch: 5, name: 'Giờ Tỵ', range: '09:00–11:00' },
  { branch: 6, name: 'Giờ Ngọ', range: '11:00–13:00' },
  { branch: 7, name: 'Giờ Mùi', range: '13:00–15:00' },
  { branch: 8, name: 'Giờ Thân', range: '15:00–17:00' },
  { branch: 9, name: 'Giờ Dậu', range: '17:00–19:00' },
  { branch: 10, name: 'Giờ Tuất', range: '19:00–21:00' },
  { branch: 11, name: 'Giờ Hợi', range: '21:00–23:00' },
];

export function translateGanZhi(gz: string): string {
  if (!gz) return '';
  let out = gz;
  for (const [cn, vi] of Object.entries(CN_TO_VI_STEM)) {
    out = out.replaceAll(cn, vi + ' ');
  }
  for (const [cn, vi] of Object.entries(CN_TO_VI_BRANCH)) {
    out = out.replaceAll(cn, vi);
  }
  return out.trim().replace(/\s+/g, ' ');
}

// ─── 2. Mười Hai Cung (12 Palaces — Chuẩn hóa Tử Nữ & Giao Hữu) ─────────────
export const CN_TO_VI_PALACE: Record<string, string> = {
  '命宫': 'Mệnh Cung',
  '命': 'Mệnh Cung',
  '身宫': 'Thân Cung',
  '身': 'Thân Cung',
  '兄弟宫': 'Huynh Đệ',
  '兄弟': 'Huynh Đệ',
  '夫妻宫': 'Phu Thê',
  '夫妻': 'Phu Thê',
  '子女宫': 'Tử Nữ',
  '子女': 'Tử Nữ',
  '财帛宫': 'Tài Bạch',
  '财帛': 'Tài Bạch',
  '疾厄宫': 'Tật Ách',
  '疾厄': 'Tật Ách',
  '迁移宫': 'Thiên Di',
  '迁移': 'Thiên Di',
  '交友宫': 'Giao Hữu',
  '交友': 'Giao Hữu',
  '仆役宫': 'Giao Hữu',
  '仆役': 'Giao Hữu',
  '奴仆宫': 'Giao Hữu',
  '奴仆': 'Giao Hữu',
  '官禄宫': 'Quan Lộc',
  '官禄': 'Quan Lộc',
  '田宅宫': 'Điền Trạch',
  '田宅': 'Điền Trạch',
  '福德宫': 'Phúc Đức',
  '福德': 'Phúc Đức',
  '父母宫': 'Phụ Mẫu',
  '父母': 'Phụ Mẫu',
};

export function translatePalaceName(name?: string): string {
  if (!name) return '';
  return CN_TO_VI_PALACE[name] ?? CN_TO_VI_PALACE[name.replace('宫', '')] ?? name;
}

export const VI_PALACE_ROLES: Record<string, string> = {
  '命宫': 'Bản mệnh, tính cách cốt lõi, khí chất & tiên thiên cách cục',
  '兄弟': 'Anh chị em, bằng hữu thân thiết, đối tác hợp tác',
  '兄弟宫': 'Anh chị em, bằng hữu thân thiết, đối tác hợp tác',
  '夫妻': 'Tình duyên, hôn nhân, hình mẫu người phối ngẫu',
  '夫妻宫': 'Tình duyên, hôn nhân, hình mẫu người phối ngẫu',
  '子女': 'Cung Tử Nữ (Tử Tức) — Con cái, hậu vận, học trò & cấp dưới',
  '子女宫': 'Cung Tử Nữ (Tử Tức) — Con cái, hậu vận, học trò & cấp dưới',
  '财帛': 'Tài lộc, nguồn thu nhập, phương thức quản lý tài chính',
  '财帛宫': 'Tài lộc, nguồn thu nhập, phương thức quản lý tài chính',
  '疾厄': 'Sức khỏe, thể chất, tạng phủ & tai ách tiềm ẩn',
  '疾厄宫': 'Sức khỏe, thể chất, tạng phủ & tai ách tiềm ẩn',
  '迁移': 'Xuất ngoại, cơ hội bên ngoài, quý nhân phương xa & xã giao',
  '迁移宫': 'Xuất ngoại, cơ hội bên ngoài, quý nhân phương xa & xã giao',
  '仆役': 'Cung Giao Hữu (Nô Bộc) — Bạn bè, đồng nghiệp, nhân duyên quần chúng & trợ lực',
  '交友': 'Cung Giao Hữu (Nô Bộc) — Bạn bè, đồng nghiệp, nhân duyên quần chúng & trợ lực',
  '交友宫': 'Cung Giao Hữu (Nô Bộc) — Bạn bè, đồng nghiệp, nhân duyên quần chúng & trợ lực',
  '官禄': 'Sự nghiệp, công danh, chức vị & năng lực hành động',
  '官禄宫': 'Sự nghiệp, công danh, chức vị & năng lực hành động',
  '田宅': 'Bất động sản, điền sản, gia đạo & tích lũy tài khố',
  '田宅宫': 'Bất động sản, điền sản, gia đạo & tích lũy tài khố',
  '福德': 'Đời sống tinh thần, phúc phận, tâm tính & an hưởng tuổi già',
  '福德宫': 'Đời sống tinh thần, phúc phận, tâm tính & an hưởng tuổi già',
  '父母': 'Cha mẹ, trưởng bối, học vấn, văn thư & pháp lý',
  '父母宫': 'Cha mẹ, trưởng bối, học vấn, văn thư & pháp lý',
};

// ─── 3. Ngũ Hành Cục, Âm Dương, Tứ Hóa, Độ Sáng ────────────────────────────
export const CN_TO_VI_WUXING_JU: Record<string, string> = {
  '水二局': 'Thủy Nhị Cục',
  '木三局': 'Mộc Tam Cục',
  '金四局': 'Kim Tứ Cục',
  '土五局': 'Thổ Ngũ Cục',
  '火六局': 'Hỏa Lục Cục',
};

export function translateWuxingJu(name: string): string {
  return CN_TO_VI_WUXING_JU[name] ?? name;
}

export const CN_TO_VI_YINYANG: Record<string, string> = {
  '阳男': 'Dương Nam',
  '阴男': 'Âm Nam',
  '阳女': 'Dương Nữ',
  '阴女': 'Âm Nữ',
};

export function translateYinYang(yy?: string): string {
  if (!yy) return '';
  return CN_TO_VI_YINYANG[yy] ?? yy;
}

export const CN_TO_VI_SIHUA: Record<string, string> = {
  '禄': 'Lộc',
  '权': 'Quyền',
  '科': 'Khoa',
  '忌': 'Kỵ',
  '化禄': 'Hóa Lộc',
  '化权': 'Hóa Quyền',
  '化科': 'Hóa Khoa',
  '化忌': 'Hóa Kỵ',
};

export function translateSiHua(sh?: string): string {
  if (!sh) return '';
  return CN_TO_VI_SIHUA[sh] ?? sh;
}

export const CN_TO_VI_BRIGHTNESS: Record<string, string> = {
  '庙': 'Miếu',
  '旺': 'Vượng',
  '得': 'Đắc',
  '利': 'Lợi',
  '平': 'Bình',
  '不': 'Bất',
  '闲': 'Nhàn',
  '陷': 'Hãm',
  '地': 'Địa',
};

export function translateBrightness(b?: string): string {
  if (!b) return '';
  return CN_TO_VI_BRIGHTNESS[b] ?? b;
}

// ─── 4. Toàn Bộ Tinh Diệu (14 Chính Tinh + Phụ Tinh + Tạp Diệu) ────────────
export const CN_TO_VI_STAR: Record<string, string> = {
  // 14 Chính Tinh
  '紫微': 'Tử Vi',
  '天机': 'Thiên Cơ',
  '太阳': 'Thái Dương',
  '武曲': 'Vũ Khúc',
  '天同': 'Thiên Đồng',
  '廉贞': 'Liêm Trinh',
  '天府': 'Thiên Phủ',
  '太阴': 'Thái Âm',
  '贪狼': 'Tham Lang',
  '巨门': 'Cự Môn',
  '天相': 'Thiên Tướng',
  '天梁': 'Thiên Lương',
  '七杀': 'Thất Sát',
  '破军': 'Phá Quân',

  // Lục Cát + Lộc Mã
  '文昌': 'Văn Xương',
  '文曲': 'Văn Khúc',
  '左辅': 'Tả Phù',
  '右弼': 'Hữu Bật',
  '天魁': 'Thiên Khôi',
  '天钺': 'Thiên Việt',
  '禄存': 'Lộc Tồn',
  '天马': 'Thiên Mã',

  // Lục Sát
  '擎羊': 'Kình Dương',
  '陀罗': 'Đà La',
  '火星': 'Hỏa Tinh',
  '铃星': 'Linh Tinh',
  '地空': 'Địa Không',
  '地劫': 'Địa Kiếp',

  // Tạp Diệu & Phụ Tinh
  '红鸾': 'Hồng Loan',
  '天喜': 'Thiên Hỷ',
  '天刑': 'Thiên Hình',
  '天姚': 'Thiên Diêu',
  '天哭': 'Thiên Khốc',
  '天虚': 'Thiên Hư',
  '龙池': 'Long Trì',
  '凤阁': 'Phượng Các',
  '三台': 'Tam Đài',
  '八座': 'Bát Tọa',
  '恩光': 'Ân Quang',
  '天贵': 'Thiên Quý',
  '台辅': 'Đài Phụ',
  '封诰': 'Phong Cáo',
  '天官': 'Thiên Quan',
  '天福': 'Thiên Phúc',
  '天才': 'Thiên Tài',
  '天寿': 'Thiên Thọ',
  '孤辰': 'Cô Thần',
  '寡宿': 'Quả Tú',
  '天空': 'Thiên Không',
  '旬空': 'Tuần Không',
  '副旬': 'Phó Tuần',
  '截空': 'Triệt Không',
  '截路': 'Triệt Lộ',
  '副截': 'Phó Triệt',
  '空亡': 'Không Vong',
  '大耗': 'Đại Hao',
  '天使': 'Thiên Sứ',
  '天伤': 'Thiên Thương',
  '天月': 'Thiên Nguyệt',
  '阴煞': 'Âm Sát',
  '蜚廉': 'Phi Liêm',
  '解神': 'Giải Thần',
  '年解': 'Niên Giải',
  '天德': 'Thiên Đức',
  '月德': 'Nguyệt Đức',
  '天巫': 'Thiên Vu',
  '华盖': 'Hoa Cái',
  '咸池': 'Hàm Trì',
  '劫煞': 'Kiếp Sát',
  '龙德': 'Long Đức',
  '破碎': 'Phá Toái',
  '天厨': 'Thiên Trù',
  '红艳': 'Hồng Diễm',
  '桃花': 'Đào Hoa',
  // Bác Sĩ 12 Thần
  '博士': 'Bác Sĩ',
  '力士': 'Lực Sĩ',
  '青龙': 'Thanh Long',
  '小耗': 'Tiểu Hao',
  '将军': 'Tướng Quân',
  '奏书': 'Tấu Thư',
  '飞廉': 'Phi Liêm',
  '喜神': 'Hỷ Thần',
  '病符': 'Bệnh Phù',
  '伏兵': 'Phục Binh',
  '官府': 'Quan Phủ',
  '官符': 'Quan Phù',
  // Tuế Tiền 12 Thần (shier-shen.ts)
  '岁建': 'Tuế Kiến',
  '晦气': 'Hối Khí',
  '丧门': 'Tang Môn',
  '贯索': 'Quán Sách',
  '岁破': 'Tuế Phá',
  '白虎': 'Bạch Hổ',
  '吊客': 'Điếu Khách',
  // Tướng Tiền 12 Thần (shier-shen.ts)
  '将星': 'Tướng Tinh',
  '攀鞍': 'Phan Án',
  '岁驿': 'Tuế Dịch',
  '息神': 'Tức Thần',
  '灾煞': 'Tai Sát',
  '天煞': 'Thiên Sát',
  '指背': 'Chỉ Bối',
  '月煞': 'Nguyệt Sát',
  '亡神': 'Vong Thần',
  // Trường Sinh 12 Thần
  '长生': 'Trường Sinh',
  '沐浴': 'Mộc Dục',
  '冠带': 'Quan Đới',
  '临官': 'Lâm Quan',
  '帝旺': 'Đế Vượng',
  '衰': 'Suy',
  '病': 'Bệnh',
  '死': 'Tử',
  '墓': 'Mộ',
  '绝': 'Tuyệt',
  '胎': 'Thai',
  '养': 'Dưỡng',
};

export function translateStarName(name?: string, showHanzi = false): string {
  if (!name) return '';
  const vi = CN_TO_VI_STAR[name] ?? name;
  return showHanzi && vi !== name ? `${vi} (${name})` : vi;
}

// ─── 5. Dịch Tỉnh/Thành Phố sang Hán-Việt ───────────────────────────────────
const CN_PROVINCE_VI: Record<string, string> = {
  '北京市': 'Trung Quốc — Bắc Kinh',
  '天津市': 'Trung Quốc — Thiên Tân',
  '上海市': 'Trung Quốc — Thượng Hải',
  '重庆市': 'Trung Quốc — Trùng Khánh',
  '广东省': 'Trung Quốc — Quảng Đông',
  '广西壮族自治区': 'Trung Quốc — Quảng Tây',
  '云南省': 'Trung Quốc — Vân Nam',
  '浙江省': 'Trung Quốc — Chiết Giang',
  '江苏省': 'Trung Quốc — Giang Tô',
  '福建省': 'Trung Quốc — Phúc Kiến',
  '四川省': 'Trung Quốc — Tứ Xuyên',
  '湖北省': 'Trung Quốc — Hồ Bắc',
  '湖南省': 'Trung Quốc — Hồ Nam',
  '山东省': 'Trung Quốc — Sơn Đông',
  '河南省': 'Trung Quốc — Hà Nam',
  '河北省': 'Trung Quốc — Hà Bắc',
  '陕西省': 'Trung Quốc — Thiểm Tây',
  '山西省': 'Trung Quốc — Sơn Tây',
  '安徽省': 'Trung Quốc — An Huy',
  '江西省': 'Trung Quốc — Giang Tây',
  '海南省': 'Trung Quốc — Hải Nam',
  '贵州省': 'Trung Quốc — Quý Châu',
  '辽宁省': 'Trung Quốc — Liêu Ninh',
  '吉林省': 'Trung Quốc — Cát Lâm',
  '黑龙江省': 'Trung Quốc — Hắc Long Giang',
  '内蒙古自治区': 'Trung Quốc — Nội Mông',
  '甘肃省': 'Trung Quốc — Cam Túc',
  '青海省': 'Trung Quốc — Thanh Hải',
  '宁夏回族自治区': 'Trung Quốc — Ninh Hạ',
  '新疆维吾尔自治区': 'Trung Quốc — Tân Cương',
  '西藏自治区': 'Trung Quốc — Tây Tạng',
  '香港特别行政区': 'Hồng Kông (Đặc khu)',
  '澳门特别行政区': 'Ma Cao (Đặc khu)',
  '台湾省': 'Đài Loan',
};

export function translateProvinceName(prov: string): string {
  return CN_PROVINCE_VI[prov] ?? prov;
}

// ─── 6. Bách Khoa 14 Chính Tinh & Tứ Hóa (Hệ thống Nghê Hải Hạ) ───────────
export interface ViStarDetail {
  viName: string;
  hanzi: string;
  element: string;
  nature: string;
  keywords: string[];
  brief: string;
  niHaixia: string;
  classical: string;
  bestPalace: string;
  worstPalace: string;
  career: string;
  relationship: string;
  wealth: string;
  health: string;
}

export const VI_STAR_DETAILS: Record<string, ViStarDetail> = {
  '紫微': {
    viName: 'Tử Vi',
    hanzi: '紫微',
    element: 'Thổ (Âm Đẩu Đế Vương Tinh)',
    nature: 'Đế tinh · Tôn quý · Thống lĩnh',
    keywords: ['Đế Vương', 'Tôn Quý', 'Lãnh Đạo', 'Độc Lập'],
    brief: 'Thiên Hoàng Quý Tinh, thống lĩnh quần tinh. Người có Tử Vi tọa Mệnh mang khí chất tự tôn, uy quyền hiển đạt, bẩm sinh có phong thái lãnh đạo.',
    niHaixia: 'Danh sư Nghê Hải Hạ nhấn mạnh: Tử Vi là sao Hoàng Đế, tọa Mệnh cung thì có khí chất cô ngạo, ưa độc lập, không thích bị người khác quản thúc. Tử Vi bắt buộc phải có Tả Phù, Hữu Bật hội chiếu hoặc giáp Mệnh mới phát huy được uy quyền Đế Vương; nếu không có Phụ Bật thì chỉ là "Cô Quân tại dã", giàu mà không sang. Tử Vi ở cung Thìn, Tuất hội Thiên Phủ hoặc ở Dần, Thân đồng cung Thiên Phủ là cách cục song tinh đắc địa, tài quan song mỹ, xuất tướng nhập tướng. Tử Vi kỵ nhất Hỏa Tinh, Linh Tinh, Kình Dương, Đà La đồng cung.',
    classical: 'Cổ quyết: "Tử Vi Đế Tọa lâm Mệnh chủ tôn quý, thống lĩnh chúng tinh." Tử Vi Đẩu Số Toàn Thư chép: "Tử Vi thủ Mệnh tại Thìn Tuất Dần Thân, hội Tả Hữu Xương Khúc Khôi Việt, vị chí tam công, phú quý song toàn."',
    bestPalace: 'Mệnh Cung (Dần, Thân, Ngọ, Thìn, Tuất), Quan Lộc',
    worstPalace: 'Tật Ách, Phu Thê (dễ muộn hôn nhân)',
    career: 'Quản lý cấp cao, chính giới, điều hành doanh nghiệp, khởi nghiệp độc lập, vị trí đứng đầu tổ chức',
    relationship: 'Tự tôn cao, trong tình cảm thường giữ thế chủ động hoặc kén chọn; kết hôn muộn hoặc chọn bạn đời chín chắn, tôn trọng lẫn nhau sẽ bền vững',
    wealth: 'Tài vận vững vàng, giỏi giữ của và hoạch định dài hạn, hợp đầu tư tích lũy quy mô lớn',
    health: 'Thuộc hành Thổ, cần lưu ý tỳ vị và hệ tiêu hóa; tránh làm việc lao tâm quá độ, giữ nhịp sinh hoạt điều độ',
  },
  '天机': {
    viName: 'Thiên Cơ',
    hanzi: '天机',
    element: 'Mộc (Thiện Tinh · Trí Tuệ Tinh)',
    nature: 'Mưu lược · Linh hoạt · Biến thông',
    keywords: ['Trí Tuệ', 'Cơ Biến', 'Tham Mưu', 'Linh Hoạt'],
    brief: 'Sao chủ về trí mưu, sự biến hóa và khả năng hoạch định chiến lược. Tư duy nhạy bén, sắc sảo, hợp làm quân sư, kỹ thuật, nghiên cứu.',
    niHaixia: 'Nghê Sư giảng: Thiên Cơ là sao Quân Sư, Tham Mưu — ngôi sao thông minh nhất trong Tử Vi, nhưng thông minh lộ ra ngoài quá mức thì dễ hao tâm tổn thần. Thiên Cơ Hóa Kỵ là đáng ngại nhất, biểu thị "thông minh quá bị thông minh hại", suy nghĩ quá nhiều dẫn đến mất ngủ, do dự. Thiên Cơ thuộc Mộc, chủ sự vận động và biến thông; tọa Mệnh thì đầu óc cực kỳ nhạy bén, hợp phát triển ở phương xa hoặc làm chuyên gia cố vấn.',
    classical: 'Cổ quyết: "Thiên Cơ vi nhân tinh hoạt, thiện tác kinh doanh, cư miếu vượng địa chủ nhân tinh minh, thiện sách hoạch."',
    bestPalace: 'Mệnh Cung (Tý, Ngọ, Mão, Dậu, Thìn, Tuất), Quan Lộc',
    worstPalace: 'Phu Thê (dễ đa đoan, suy nghĩ nhiều), Tật Ách',
    career: 'Chuyên gia công nghệ, chiến lược gia, cố vấn, nghiên cứu R&D, kiến trúc hệ thống, hoạch định tài chính',
    relationship: 'Tâm tư tinh tế nhưng hay suy diễn; nên kết hôn muộn hoặc chọn người bạn đời điềm đạm, bao dung',
    wealth: 'Kiếm tiền bằng trí tuệ và chuyên môn kỹ thuật; dòng tiền lưu chuyển nhanh, nên chuyển hóa thành tài sản cố định',
    health: 'Thuộc hành Mộc, chủ về gan mật, hệ thần kinh và giấc ngủ; nên rèn luyện thiền định và vận động ngoài trời',
  },
  '太阳': {
    viName: 'Thái Dương',
    hanzi: '太阳',
    element: 'Hỏa (Trung Thiên Đế Tinh · Quan Lộc Chủ)',
    nature: 'Quang minh · Bác ái · Danh vọng',
    keywords: ['Quang Minh', 'Quan Quý', 'Hào Sảng', 'Công Danh'],
    brief: 'Chủ cung Quan Lộc, đại diện cho ánh sáng mặt trời, thanh danh, sự hào sảng và chính trực. Nhập miếu từ cung Dần đến cung Ngọ rực rỡ nhất.',
    niHaixia: 'Nghê Sư phân tích: Thái Dương là ngôi sao quang minh chính đại, từ cung Mão đến cung Ngọ là nhập Miếu Vượng, ánh sáng rực rỡ nhất; qua cung Mùi về đêm là lạc hãm. Người có Thái Dương tọa Mệnh hào phóng, trọng danh dự, thích giúp đỡ người khác. Nam mệnh đắc Thái Dương miếu vượng thì công danh hiển đạt; nữ mệnh có Thái Dương tọa Mệnh thì tính cách độc lập, mạnh mẽ như nam giới. Nếu lạc hãm thì vất vả, làm ơn dễ mắc oán, tiền cần hậu nhàn.',
    classical: 'Cổ quyết: "Thái Dương cư Ngọ vi Nhật Lệ Trung Thiên, quang huy đại phóng, chủ quý hiển, tài quan song mỹ."',
    bestPalace: 'Mệnh Cung (Mão, Thìn, Tỵ, Ngọ), Quan Lộc',
    worstPalace: 'Phu Thê (nữ mệnh dễ khắc khẩu), Tật Ách',
    career: 'Ngoại giao, chính trị, quản lý công, truyền thông, giáo dục, luật pháp, lãnh đạo cộng đồng',
    relationship: 'Nam mệnh đào hoa, trọng trách nhiệm; nữ mệnh cá tính mạnh mẽ, nên chọn bạn đời biết sẻ chia và tôn trọng sự nghiệp',
    wealth: 'Trọng danh hơn trọng lợi, tiền bạc đến từ danh tiếng và địa vị; hào phóng chi tiêu cho bạn bè và gia đình',
    health: 'Thuộc Bính Hỏa, chủ về tim mạch, huyết áp và đôi mắt (đặc biệt mắt trái); cần tránh thức khuya và căng thẳng',
  },
  '武曲': {
    viName: 'Vũ Khúc',
    hanzi: '武曲',
    element: 'Kim (Bắc Đẩu Chính Tài Tinh)',
    nature: 'Tài bạch chủ · Cương nghị · Quyết đoán',
    keywords: ['Chính Tài', 'Quả Quyết', 'Thực Thi', 'Cương Nghị'],
    brief: 'Chủ cung Tài Bạch, ngôi sao của tài chính, thực nghiệp và ý chí sắt đá. Hành động dứt khoát, nói đi đôi với làm.',
    niHaixia: 'Nghê Sư coi Vũ Khúc là Chính Tài Tinh, tính chất cương cứng bất khuất, nhưng mang tính cô khắc. Người Vũ Khúc tọa Mệnh ý chí kiên cường, cực kỳ hợp ngành tài chính, ngân hàng, quân đội, kỹ thuật thực chiến. Tuy nhiên trong tình cảm lại quá thẳng thắn, thiếu sự mềm mỏng. Vũ Khúc ở Thìn, Tuất, Sửu, Mùi đều đắc địa; hội Tham Lang thành cách "Vũ Tham bất phát thiếu niên nhân" — sau 30 tuổi phát đạt lớn.',
    classical: 'Cổ quyết: "Vũ Khúc thuộc Kim, cương cường chi tính, thủ Mệnh tại vượng địa, tài quan song mỹ, xuất tướng nhập tướng."',
    bestPalace: 'Tài Bạch, Mệnh Cung (Thìn, Tuất, Sửu, Mùi), Quan Lộc',
    worstPalace: 'Phu Thê (chủ muộn hôn nhân)',
    career: 'Tài chính, ngân hàng, đầu tư, kiểm toán, quân cảnh, kỹ thuật cơ khí, điều hành sản xuất',
    relationship: 'Thẳng thắn, thực tế, ít nói lời hoa mỹ; kết hôn muộn sau 28–30 tuổi giúp gia đạo êm ấm, bền chặt',
    wealth: 'Bản mệnh Tài tinh, năng lực kiếm tiền và tích lũy tài sản cực mạnh, càng thực chiến càng giàu có',
    health: 'Thuộc hành Kim, lưu ý phổi, hệ hô hấp, mũi họng và xương khớp; khi Hóa Kỵ cần cẩn trọng va chạm kim khí',
  },
  '天同': {
    viName: 'Thiên Đồng',
    hanzi: '天同',
    element: 'Thủy (Nam Đẩu Phúc Tinh)',
    nature: 'Phúc đức chủ · Ôn hòa · Hưởng phúc',
    keywords: ['Phúc Tinh', 'Ôn Hòa', 'Thiện Lương', 'Hưởng Lạc'],
    brief: 'Chủ cung Phúc Đức, ngôi sao của phúc lộc, sự an nhiên, nhân duyên tốt đẹp và nghệ thuật thưởng thức cuộc sống.',
    niHaixia: 'Nghê Sư nói: Thiên Đồng là Phúc Tinh, tính tình ôn hòa, không thích tranh đấu gay gắt. Thiên Đồng tọa Mệnh ưa sự an ổn, nhân duyên cực tốt, đi đến đâu cũng được mọi người quý mến. Thiên Đồng Hóa Lộc là Hóa Lộc đẹp nhất về phúc khí, cả đời cơm áo đủ đầy, tâm hồn thư thái. Tuy nhiên Thiên Đồng cần có chút kích phát (hoặc hội Thiên Lương) để tránh ỷ lại, biến phúc thành động lực tiến thân.',
    classical: 'Cổ quyết: "Thiên Đồng vi Phúc Đức chi tinh, tọa Mệnh giả hưởng phúc hữu dư, tam phương vô sát nhất sinh khoái lạc."',
    bestPalace: 'Phúc Đức, Mệnh Cung, Tử Nữ',
    worstPalace: 'Quan Lộc (nếu thiếu sao kích phát dễ thiếu tham vọng)',
    career: 'Văn hóa nghệ thuật, dịch vụ cao cấp, tâm lý học, y tế chăm sóc, giáo dục, ngoại giao hòa giải',
    relationship: 'Dịu dàng, giàu lòng trắc ẩn, biết lắng nghe; hôn nhân ấm áp nhưng cần giữ lập trường rõ ràng',
    wealth: 'Lộc tự nhiên tìm đến, không ưa đầu cơ mạo hiểm, hậu vận sung túc nhờ tích phúc và nhân mạch',
    health: 'Thuộc Nhâm Thủy, lưu ý thận, bàng quang, tai và hệ nội tiết; tránh ăn uống quá đà gây tăng cân',
  },
  '廉贞': {
    viName: 'Liêm Trinh',
    hanzi: '廉贞',
    element: 'Hỏa (Bắc Đẩu Thứ Đào Hoa · Quan Lộc Chủ)',
    nature: 'Thanh liêm · Tài nghệ · Quyền biến',
    keywords: ['Tài Nghệ', 'Đào Hoa', 'Chính Trực', 'Cải Cách'],
    brief: 'Ngôi sao vừa mang tính kỷ cương, hành chính, vừa mang nét tài hoa nghệ thuật và sức hút đào hoa đặc biệt.',
    niHaixia: 'Nghê Sư phân tích: Liêm Trinh là Thứ Đào Hoa, tài hoa xuất chúng nhưng tình cảm sâu sắc, phức tạp. Liêm Trinh đồng cung với Thiên Tướng tại Tý Ngọ thì "hóa hung vi cát", tạo thành cách cục Hành Chính Ấn Thụ rất quý hiển. Ngược lại, Liêm Trinh Hóa Kỵ thì phải hết sức cẩn thận về tranh chấp pháp lý, giấy tờ hoặc tai nạn huyết quang. Nếu giữ tâm chính trực, Liêm Trinh phát huy năng lực tổ chức và sáng tạo phi thường.',
    classical: 'Cổ quyết: "Liêm Trinh vi thứ đào hoa, Liêm Tướng đồng cung hóa hung vi cát, chưởng hành chính đại quyền."',
    bestPalace: 'Quan Lộc (phối Thiên Tướng), Mệnh Cung (khi Hóa Lộc)',
    worstPalace: 'Phu Thê, Tật Ách (khi Hóa Kỵ)',
    career: 'Pháp luật, hành chính công, thiết kế sáng tạo, nghệ thuật biểu diễn, ngoại giao, kiểm soát nội bộ',
    relationship: 'Sức hút cá nhân lớn, tình cảm nồng nhiệt; nên kết hôn muộn và chọn người bạn đời điềm tĩnh, chín chắn',
    wealth: 'Kiếm tiền nhờ tài năng độc đáo hoặc vị thế quản lý; khi gặp Hóa Lộc phát tài rất nhanh',
    health: 'Thuộc Đinh Hỏa, lưu ý hệ tuần hoàn máu, tim mạch và miễn dịch; giữ tâm bình khí hòa',
  },
  '天府': {
    viName: 'Thiên Phủ',
    hanzi: '天府',
    element: 'Thổ (Nam Đẩu Đế Tinh · Tài Khố Chủ)',
    nature: 'Tài khố · Ổn trọng · Bao dung',
    keywords: ['Tài Khố', 'Ổn Trọng', 'Thủ Thành', 'Phúc Hậu'],
    brief: 'Chủ đế tinh phương Nam, cai quản kho tàng Tài Bạch và Điền Trạch. Tính cách điềm đạm, bao dung, giỏi tích lũy và quản trị.',
    niHaixia: 'Nghê Sư giảng: Thiên Phủ là sao Tài Khố (kho tiền của nhà trời), chuyên về thủ thành và giữ của. Người Thiên Phủ tọa Mệnh điềm tĩnh, cẩn trọng, có năng lực tổ chức và quản trị tài sản xuất sắc. Nữ mệnh có Thiên Phủ tọa Mệnh là bậc vượng phu ích tử, giữ gìn cơ nghiệp hưng thịnh. Thiên Phủ thích nhất hội Tử Vi hoặc Lộc Tồn; kỵ nhất Địa Không, Địa Kiếp xâm phạm làm "kho thủng" (Khố Lộ).',
    classical: 'Cổ quyết: "Thiên Phủ vi Lộc Khố chi tinh, thủ Mệnh giả ổn trọng bảo thủ, tam phương cát tụ, phú quý an khang."',
    bestPalace: 'Mệnh Cung, Tài Bạch, Điền Trạch',
    worstPalace: 'Tật Ách (nếu gặp Không Kiếp)',
    career: 'Ngân hàng, quản lý quỹ, bất động sản, hành chính nhân sự cấp cao, điều hành tập đoàn gia đình',
    relationship: 'Trọng gia đình, thủy chung, mang lại cảm giác an toàn vững chắc cho người bạn đời',
    wealth: 'Kho tài lộc dồi dào, cực kỳ giỏi tích lũy bất động sản và tài sản bền vững qua năm tháng',
    health: 'Thuộc Mậu Thổ, lưu ý dạ dày và tiêu hóa; thể chất nhìn chung bền bỉ, phúc thọ dồi dào',
  },
  '太阴': {
    viName: 'Thái Âm',
    hanzi: '太阴',
    element: 'Thủy (Trung Thiên Đế Tinh · Điền Trạch & Tài Bạch Chủ)',
    nature: 'Nhu mỹ · Phú túc · Nội tâm',
    keywords: ['Điền Sản', 'Tài Phú', 'Tinh Tế', 'Thanh Nhã'],
    brief: 'Ánh trăng thanh khiết, chủ cung Điền Trạch và Tài Phú. Đại diện cho sự tinh tế, giàu có ngầm, bất động sản và vẻ đẹp dịu dàng.',
    niHaixia: 'Nghê Sư nhận định: Thái Âm là sao Tài Phú và Điền Trạch, đại diện cho người mẹ và người vợ trong mệnh nam, đồng thời là bản chất thanh tú của mệnh nữ. Thái Âm nhập miếu ở Dậu, Tuất, Hợi, Tý (đặc biệt Hợi Tý là "Nguyệt Lãng Thiên Môn" và "Thủy Trừng Quế Ngạc") thì ánh trăng sáng ngời, giàu có lớn về điền sản. Nam mệnh sợ nhất Thái Âm Hóa Kỵ dễ dẫn đến bất hòa giữa mẹ và vợ.',
    classical: 'Cổ quyết: "Thái Âm vi Tài tinh, Hợi Tý nhập miếu quang huy toàn chiếu, Nguyệt Lãng Thiên Môn, phú quý vinh hoa."',
    bestPalace: 'Điền Trạch, Tài Bạch, Mệnh Cung (Dậu, Tuất, Hợi, Tý)',
    worstPalace: 'Mệnh Cung (cung Mão, Thìn, Tỵ, Ngọ lạc hãm)',
    career: 'Đầu tư bất động sản, tài chính, văn học nghệ thuật, thẩm mỹ, giáo dục, khách sạn nghỉ dưỡng',
    relationship: 'Trọng tình cảm sâu sắc, lãng mạn và tinh tế; nam mệnh đắc Thái Âm miếu vượng cưới được vợ hiền đẹp',
    wealth: 'Tích lũy tài sản bền bỉ, có duyên lớn với đất đai, nhà cửa và đầu tư giá trị dài hạn',
    health: 'Thuộc Quý Thủy, lưu ý thận, hệ tiết niệu, nội tiết tố và mắt phải; giữ tinh thần lạc quan',
  },
  '贪狼': {
    viName: 'Tham Lang',
    hanzi: '贪狼',
    element: 'Mộc đới Thủy (Bắc Đẩu Chính Đào Hoa · Đa Tài Tinh)',
    nature: 'Đa tài · Giao tế · Khát vọng',
    keywords: ['Đa Tài', 'Đào Hoa', 'Giao Tế', 'Hoành Phát'],
    brief: 'Ngôi sao đa tài đa nghệ bậc nhất trong Tử Vi, giỏi giao tế, nhạy bén với cơ hội mới, đam mê học hỏi cả nghệ thuật lẫn huyền học.',
    niHaixia: 'Nghê Sư giảng: Tham Lang là ngôi sao đa tài đa nghệ nhất, vừa chủ về Đào Hoa nhân duyên, vừa chủ về khát vọng vươn lên và duyên với ngũ thuật, tôn giáo. Tham Lang Hóa Lộc nhập Mệnh thì sức hút cá nhân cực lớn, đi đâu cũng có quý nhân và cơ hội tài lộc. Đặc biệt Tham Lang gặp Hỏa Tinh hoặc Linh Tinh đồng cung/hội chiếu sẽ tạo thành cách "Hỏa Tham" hoặc "Linh Tham" — chủ hoành phát tài lộc bất ngờ, phát đạt mạnh từ trung vận.',
    classical: 'Cổ quyết: "Tham Lang hội Hỏa Linh, miếu vượng danh chấn chư bang, bộc phát hoành tài."',
    bestPalace: 'Mệnh Cung (Dần, Thân, Thìn, Tuất, Sửu, Mùi), Tài Bạch (hội Hỏa Linh)',
    worstPalace: 'Phu Thê (dễ đa tình nếu thiếu cát tinh), Tật Ách',
    career: 'Quan hệ công chúng (PR), giải trí, thương mại quốc tế, marketing, ngoại giao, nghệ thuật, nghiên cứu huyền học',
    relationship: 'Sức quyến rũ bẩm sinh, nhân duyên khác giới rất vượng; nên kết hôn muộn sau khi sự nghiệp đã định hình',
    wealth: 'Kiếm tiền nhờ mạng lưới quan hệ rộng và sự nhạy bén thương trường; gặp Hỏa/Linh dễ có lộc lớn bất ngờ',
    health: 'Thuộc Giáp Mộc đới Thủy, lưu ý gan mật và thận; tiết chế tiệc tùng để giữ nguyên khí dồi dào',
  },
  '巨门': {
    viName: 'Cự Môn',
    hanzi: '巨门',
    element: 'Thủy (Bắc Đẩu Ám Tinh · Khẩu Tài Tinh)',
    nature: 'Hùng biện · Tư biện · Chuyên sâu',
    keywords: ['Khẩu Tài', 'Tư Biện', 'Nghiên Cứu', 'Chuyên Gia'],
    brief: 'Ngôi sao của ngôn từ, khả năng hùng biện, phân tích sâu sắc và nghiên cứu chuyên môn đến tận gốc rễ.',
    niHaixia: 'Nghê Sư phân tích: Cự Môn bản chất là Ám Tinh chủ về khẩu thiệt, nhưng khi gặp Hóa Lộc, Hóa Quyền hoặc hội Thái Dương miếu vượng ("Cự Nhật đồng cung" ở Dần) thì chuyển hóa thành tài ăn nói xuất chúng, dùng lời nói mà lập nghiệp lớn. Người Cự Môn ở Tý, Ngọ tạo thành cách "Thạch Trung Ẩn Ngọc" (ngọc ẩn trong đá) — bề ngoài khiêm nhường nhưng bên trong tài học uyên bác, trung vận phát đạt rực rỡ. Kỵ nhất Cự Môn Hóa Kỵ dễ vướng thị phi lời nói.',
    classical: 'Cổ quyết: "Cự Môn Tý Ngọ khoa quyền lộc, Thạch Trung Ẩn Ngọc, phú quý vinh hoa; Cự Nhật Dần cung, tam đại vinh xương."',
    bestPalace: 'Mệnh Cung (Tý, Ngọ, Dần), Quan Lộc (khi Hóa Lộc/Quyền)',
    worstPalace: 'Phu Thê, Huynh Đệ (khi Hóa Kỵ dễ tranh cãi)',
    career: 'Luật sư, giảng viên đại học, diễn giả, ngoại giao, truyền thông, thẩm phán, y khoa chẩn đoán, nghiên cứu học thuật',
    relationship: 'Thích đối thoại sâu sắc về trí tuệ; trong hôn nhân cần tránh bắt bẻ câu chữ, lấy sự bao dung làm gốc',
    wealth: 'Khẩu tài sinh tài — thu nhập đến từ tri thức chuyên gia, thương thuyết, giảng dạy và tư vấn',
    health: 'Thuộc Quý Thủy, lưu ý đường hô hấp trên, vòm họng, dạ dày và hệ tiêu hóa',
  },
  '天相': {
    viName: 'Thiên Tướng',
    hanzi: '天相',
    element: 'Thủy (Nam Đẩu Ấn Tinh · Tể Tướng Tinh)',
    nature: 'Ấn thụ · Công chính · Điều phối',
    keywords: ['Ấn Tinh', 'Chính Trực', 'Điều Phối', 'Quý Nhân'],
    brief: 'Ngôi sao nắm giữ ấn tín nhà trời, tượng trưng cho phẩm chất công tâm, lịch thiệp, trọng chữ tín và năng lực phò tá, điều phối tổ chức.',
    niHaixia: 'Nghê Sư nói: Thiên Tướng là Ấn Thụ Tinh, giống như vị Tể tướng giữ ấn tín quốc gia. Người Thiên Tướng tọa Mệnh làm việc chuẩn mực, trọng lễ nghĩa, giữ chữ tín. Thiên Tướng rất nhạy với hai cung giáp bên cạnh: được Tài Ấm Giáp Ấn (Hóa Lộc và Thiên Lương giáp) là đại quý cách; ngược lại sợ Hình Kỵ Giáp Ấn. Thiên Tướng đồng cung Liêm Trinh ở Tý Ngọ hoặc hội Thiên Phủ ("Phủ Tướng triều viên") đều là bậc trụ cột trong tổ chức.',
    classical: 'Cổ quyết: "Thiên Tướng vi Ấn thụ chi tinh, Phủ Tướng triều viên thiên chung thực lộc, y thực phong túc."',
    bestPalace: 'Mệnh Cung, Quan Lộc, Tài Bạch',
    worstPalace: 'Cung bị Hình Kỵ giáp chiếu',
    career: 'Quản trị hành chính, nhân sự cấp cao, thư ký điều hành, thẩm phán, cố vấn pháp chế, dịch vụ tài chính',
    relationship: 'Chung thủy, biết chăm lo cho gia đình và giữ hòa khí; thường nên duyên với người quen biết, đồng nghiệp',
    wealth: 'Tài lộc ổn định, y thực phong túc, thu nhập gắn liền với uy tín và chức vụ cao',
    health: 'Thuộc Nhâm Thủy, lưu ý thận, bàng quang, hệ bạch huyết và da liễu',
  },
  '天梁': {
    viName: 'Thiên Lương',
    hanzi: '天梁',
    element: 'Thổ (Nam Đẩu Ấm Tinh · Thọ Tinh)',
    nature: 'Che chở · Thanh cao · Y dược',
    keywords: ['Ấm Tinh', 'Thọ Tinh', 'Y Dược', 'Quý Nhân'],
    brief: 'Ngôi sao của sự che chở (Ấm tinh), phúc thọ, y thuật, giáo dục và quý nhân trưởng bối nâng đỡ vượt qua mọi hiểm nguy.',
    niHaixia: 'Nghê Sư giảng: Thiên Lương là Ấm Tinh — ngôi sao bảo hộ, đại diện cho y dược, tôn giáo, luật pháp và sự che chở của bề trên. Người có Thiên Lương tọa Mệnh có phong thái đĩnh đạc, giàu lòng từ bi, gặp hung hóa cát ("Thiên Lương giải ách"). Thiên Lương ở Ngọ cung là "Thọ Tinh nhập miếu", quan tư thanh hiển; hội Thái Dương, Văn Xương, Lộc Tồn thành cách "Dương Lương Xương Lộc" — đỗ đạt khoa cử, học thuật đỉnh cao.',
    classical: 'Cổ quyết: "Thiên Lương vi Ấm tinh, Ngọ vị nhập miếu danh viết Thọ Tinh nhập miếu, quan tư thanh hiển, phùng hung hóa cát."',
    bestPalace: 'Mệnh Cung (Ngọ, Tý, Thìn, Tuất, Mão), Phúc Đức, Phụ Mẫu',
    worstPalace: 'Tài Bạch (Thiên Lương trọng danh tiết hơn tiền bạc)',
    career: 'Y bác sĩ, dược học, giáo sư, thanh tra, giám sát, từ thiện xã hội, nghiên cứu triết học & tâm linh',
    relationship: 'Tình cảm chín chắn, bao dung như người trưởng bối; hợp với bạn đời có chiều sâu tâm hồn',
    wealth: 'Không màng đầu cơ trục lợi nhưng cả đời có quý nhân và phúc lộc tự nhiên bảo trợ, hậu vận thanh nhàn phú quý',
    health: 'Thuộc Mậu Thổ, lưu ý tỳ vị và xương sườn; bản chất là Thọ tinh nên sức đề kháng và tuổi thọ rất tốt',
  },
  '七杀': {
    viName: 'Thất Sát',
    hanzi: '七杀',
    element: 'Kim đới Hỏa (Nam Đẩu Tướng Tinh)',
    nature: 'Tướng tinh · Uy dũng · Khai sáng',
    keywords: ['Tướng Tinh', 'Quả Cảm', 'Đột Phá', 'Độc Lập'],
    brief: 'Vị Nguyên Soái trên chiến trường, quyết đoán, dũng mãnh, dám đương đầu thử thách lớn để lập nên cơ nghiệp phi thường.',
    niHaixia: 'Nghê Sư nhận định: Thất Sát là Tướng Tinh cầm quân ngoài biên ải, hành sự quyết liệt, nói làm ngay. Thất Sát tọa Mệnh ở Dần, Thân, Tý, Ngọ tạo thành cách "Thất Sát triều đẩu" hoặc "Thất Sát ngưỡng đẩu" — tài lãnh đạo kiệt xuất, càng gặp nghịch cảnh càng mạnh mẽ. Thất Sát đồng cung Vũ Khúc hoặc hội Lộc Quyền Khoa thì quyền uy hiển hách; nhưng cần tu dưỡng sự điềm tĩnh và có cát tinh phụ trợ để hóa giải tính cô khắc.',
    classical: 'Cổ quyết: "Thất Sát Dần Thân Tý Ngọ, nhất sinh tước lộc vinh xương, Thất Sát triều đẩu, uy trấn biên cương."',
    bestPalace: 'Mệnh Cung (Dần, Thân, Tý, Ngọ), Quan Lộc',
    worstPalace: 'Phu Thê, Phụ Mẫu',
    career: 'Khởi nghiệp tiên phong, quân đội, công an, đầu tư mạo hiểm, tái cấu trúc doanh nghiệp, phẫu thuật ngoại khoa',
    relationship: 'Yêu ghét rõ ràng, quyết liệt; nên kết hôn muộn và chọn bạn đời độc lập, thấu hiểu',
    wealth: 'Tài vận có tính đột phá lớn, dám nghĩ dám làm, thành công vang dội trong môi trường cạnh tranh cao',
    health: 'Thuộc Canh Kim đới Hỏa, lưu ý phổi, đại tràng và chấn thương thể thao; nên rèn luyện khí công dưỡng sinh',
  },
  '破军': {
    viName: 'Phá Quân',
    hanzi: '破军',
    element: 'Thủy (Bắc Đẩu Tiên Phong · Hao Tinh)',
    nature: 'Phá cựu lập tân · Khai phá · Tiên phong',
    keywords: ['Khai Phá', 'Đổi Mới', 'Tiên Phong', 'Quả Cảm'],
    brief: 'Đội quân tiên phong mở đường, mang sứ mệnh "phá cựu lập tân" — phá bỏ lối mòn cũ kỹ để kiến tạo trật tự và thành tựu hoàn toàn mới.',
    niHaixia: 'Nghê Sư giảng: Phá Quân là ngôi sao có sức mạnh "phá cựu lập tân" mạnh nhất trong Tử Vi. Phá Quân tọa Mệnh không bao giờ chịu đi theo lối mòn của người khác, cuộc đời nhiều biến động lớn nhưng khí phách hơn người. Phá Quân đắc Hóa Lộc hoặc Hóa Quyền ("Anh Tinh nhập miếu" tại Tý, Ngọ) là đại cách cục: sau khi trải qua thử thách sẽ dựng nên cơ nghiệp lẫy lừng mà người bình thường không dám mơ tới.',
    classical: 'Cổ quyết: "Phá Quân Tý Ngọ cung, vô sát quan tư thanh hiển, chí công khanh; Anh Tinh nhập miếu, văn vũ toàn tài."',
    bestPalace: 'Mệnh Cung (Tý, Ngọ), Quan Lộc (khi Hóa Lộc/Quyền)',
    worstPalace: 'Phu Thê, Tài Bạch (nếu không có Lộc Tồn/Hóa Lộc giữ kho)',
    career: 'Đổi mới sáng tạo, công nghệ đột phá, khai mở thị trường mới, nghệ thuật đương đại, logistics, kỹ thuật quân sự',
    relationship: 'Tình cảm mãnh liệt, ghét sự ràng buộc khuôn sáo; hợp kết hôn muộn với người bạn đời cùng chí hướng',
    wealth: 'Tiền tài theo quy luật "tiên phá hậu thành" — đầu tư mở đường trước rồi thu hoạch thành quả lớn về sau',
    health: 'Thuộc Quý Thủy, lưu ý thận, hệ sinh sản và xương khớp; giữ nhịp nghỉ ngơi cân bằng sau các giai đoạn bứt phá',
  },
};

export const VI_SIHUA_DETAILS: Record<string, {
  viName: string;
  attr: string;
  brief: string;
  detail: string;
}> = {
  '禄': {
    viName: 'Hóa Lộc',
    attr: 'Cát Hóa · Tài Lộc & Phúc Duyên',
    brief: 'Phúc tinh lâm cung, chủ về tài lộc dồi dào, cơ hội thuận lợi, nhân duyên tốt đẹp và sự hanh thông tự nhiên.',
    detail: 'Trong hệ thống Thiên Kỷ của Nghê Hải Hạ, Hóa Lộc là nguồn sinh khí mới, rơi vào cung nào thì cung đó trở thành nơi mang lại nguồn vui, tài lộc và sự thuận lợi lớn nhất.',
  },
  '权': {
    viName: 'Hóa Quyền',
    attr: 'Cát Hóa · Quyền Bính & Quyết Đoán',
    brief: 'Quyền tinh lâm cung, chủ về năng lực kiểm soát, sức mạnh thực thi, thăng tiến chức vụ và bản lĩnh dẫn dắt.',
    detail: 'Nghê Sư nhấn mạnh Hóa Quyền rất hợp nhập Mệnh cung, Quan Lộc cung và Tài Bạch cung, biểu thị quyền lực thực tế, khả năng tự chủ và khí chất lãnh đạo không khuất phục.',
  },
  '科': {
    viName: 'Hóa Khoa',
    attr: 'Cát Hóa · Thanh Danh & Quý Nhân',
    brief: 'Khoa danh lâm cung, chủ về học vấn, bằng cấp, uy tín xã hội, lời nói có trọng lượng và quý nhân phù trợ.',
    detail: 'Hóa Khoa còn là ngôi sao "giải thần" đệ nhất trong Tứ Hóa — khi cung vị gặp khó khăn, có Hóa Khoa hội chiếu sẽ nhờ trí tuệ và quý nhân mà hóa hiểm vi di.',
  },
  '忌': {
    viName: 'Hóa Kỵ',
    attr: 'Thử Thách · Chấp Niệm & Bài Học Nhân Sinh',
    brief: 'Ngôi sao chỉ điểm nơi tâm trí dễ chấp trước, trắc trở hoặc hao tổn nhiều tâm sức nhất — cũng chính là bài học tu dưỡng lớn nhất đời người.',
    detail: 'Nghê Sư luôn dặn: "Không xem Tứ Hóa thì mới giải được nửa lá số." Hóa Kỵ rơi vào đâu không phải để bi quan, mà để nhận diện sớm nơi cần khiêm nhường, buông xả chấp niệm và chủ động phòng ngừa.',
  },
};

// ─── 7. Chuyển ngữ Cách Cục Toàn Diện (Pattern Translation Engine) ──────────
export const PATTERN_NAME_VI: Record<string, string> = {
  // 41 cách cục trong patterns.ts
  '君臣庆会': 'Quân Thần Khánh Hội',
  '紫府同宫': 'Tử Phủ Đồng Cung',
  '府相朝垣': 'Phủ Tướng Triều Viên',
  '阳梁昌禄': 'Dương Lương Xương Lộc',
  '火贪格': 'Hỏa Tham Cách',
  '铃贪格': 'Linh Tham Cách',
  '武贪格': 'Vũ Tham Cách',
  '杀破狼': 'Sát Phá Lang Cách',
  '机月同梁': 'Cơ Nguyệt Đồng Lương',
  '机月同梁三星会': 'Cơ Nguyệt Đồng Lương (Hội 3 Sao)',
  '廉贞天相格': 'Liêm Trinh Thiên Tướng (Hùng Tú Triều Nguyên)',
  '武曲七杀': 'Vũ Khúc Thất Sát (Tướng Tài Cách)',
  '天同天梁格': 'Thiên Đồng Thiên Lương (Phúc Ấm Đồng Cung)',
  '日月同宫': 'Nhật Nguyệt Đồng Cung',
  '日月夹命': 'Nhật Nguyệt Giáp Mệnh',
  '巨日同宫': 'Cự Nhật Đồng Cung',
  '石中隐玉': 'Thạch Trung Ẩn Ngọc',
  '明珠出海': 'Minh Châu Xuất Hải',
  '紫微入命': 'Tử Vi Độc Tọa Nhập Mệnh',
  '辅弼夹命': 'Phụ Bật Giáp Mệnh',
  '昌曲夹命': 'Xương Khúc Giáp Mệnh',
  '魁钺夹命': 'Khôi Việt Giáp Mệnh',
  '双禄朝垣': 'Song Lộc Triều Viên',
  '三奇加会': 'Tam Kỳ Gia Hội',
  '羊陀夹忌': 'Dương Đà Giáp Kỵ',
  '火铃夹命': 'Hỏa Linh Giáp Mệnh',
  '空劫夹命': 'Không Kiếp Giáp Mệnh',
  '廉杀羊': 'Liêm Sát Dương Hội Chiếu',
  '巨火羊': 'Cự Hỏa Dương Hội Chiếu',
  '铃昌陀武': 'Linh Xương Đà Vũ',
  '马头带箭': 'Mã Đầu Đới Tiễn',
  '禄存守命': 'Lộc Tồn Thủ Mệnh',
  '禄存守身': 'Lộc Tồn Thủ Thân',
  '天马入命': 'Thiên Mã Nhập Mệnh',
  '天马在迁': 'Thiên Mã Tại Thiên Di',
  '化禄入财': 'Hóa Lộc Nhập Tài Bạch',
  '化权入官': 'Hóa Quyền Nhập Quan Lộc',
  '化科入命': 'Hóa Khoa Nhập Mệnh',
  '化科入身': 'Hóa Khoa Nhập Thân',
  '昌曲坐命': 'Xương Khúc Tọa Mệnh',
  '昌曲同会': 'Xương Khúc Đồng Hội',
  '辅弼同会': 'Phụ Bật Đồng Hội',
  '魁钺同会': 'Khôi Việt Đồng Hội',
  '科权双会': 'Khoa Quyền Song Hội',

  // 27 Định Quý Cục (patterns-dinggui.ts)
  '日出扶桑': 'Nhật Xuất Phù Tang',
  '月落亥宫': 'Nguyệt Lạc Hợi Cung (Nguyệt Lãng Thiên Môn)',
  '月朗天门': 'Nguyệt Lãng Thiên Môn',
  '月生沧海': 'Nguyệt Sinh Thương Hải',
  '辅弼拱主': 'Phụ Bật Củng Chủ',
  '财印夹禄': 'Tài Ấn Giáp Lộc',
  '禄马佩印': 'Lộc Mã Bội Ấn',
  '坐贵向贵': 'Tọa Quý Hướng Quý',
  '马头带剑': 'Mã Đầu Đới Kiếm',
  '七杀朝斗': 'Thất Sát Triều Đẩu',
  '日月并明': 'Nhật Nguyệt Tịnh Minh',
  '日月同临': 'Nhật Nguyệt Đồng Lâm',
  '刑囚夹印': 'Hình Tù Giáp Ấn',
  '科权禄拱': 'Khoa Quyền Lộc Củng',
  '贪火相逢': 'Tham Hỏa Tương Phùng',
  '武曲守垣': 'Vũ Khúc Thủ Viên',
  '紫府朝垣': 'Tử Phủ Triều Viên',
  '文星暗拱': 'Văn Tinh Ám Củng',
  '权禄生逢': 'Quyền Lộc Sinh Phùng',
  '羊刃入庙': 'Dương Nhận Nhập Miếu',
  '巨机居卯': 'Cự Cơ Cư Mão',
  '明禄暗禄': 'Minh Lộc Ám Lộc',
  '科明暗禄': 'Khoa Minh Ám Lộc',
  '金舆扶驾': 'Kim Dư Phù Giá',

  // 6 Định Phú Cục (patterns-dingfu.ts)
  '财荫夹印': 'Tài Ấm Giáp Ấn',
  '日月夹财': 'Nhật Nguyệt Giáp Tài',
  '财禄夹马': 'Tài Lộc Giáp Mã',
  '荫印拱身': 'Ấm Ấn Củng Thân',
  '日月照璧': 'Nhật Nguyệt Chiếu Bích',
  '金灿光辉': 'Kim Sán Quang Huy',

  // 8 Định Bần Tiện Cục (patterns-dingpin.ts)
  '生不逢时': 'Sinh Bất Phùng Thời',
  '禄逢两杀': 'Lộc Phùng Lưỡng Sát',
  '马落空亡': 'Mã Lạc Không Vong',
  '日月藏辉': 'Nhật Nguyệt Tàng Huy',
  '财与囚仇': 'Tài Dữ Tù Thù',
  '一生孤贫': 'Nhất Sinh Cô Bần',
  '君子在野': 'Quân Tử Tại Dã',
  '两重华盖': 'Lưỡng Trùng Hoa Cái',

  // 8 Định Tạp Cục (patterns-dingza.ts)
  '风云际会': 'Phong Vân Tế Hội',
  '锦上添花': 'Cẩm Thượng Thiêm Hoa',
  '禄衰马困': 'Lộc Suy Mã Khốn',
  '衣锦还乡': 'Y Cẩm Hoàn Hương',
  '步数无依': 'Bộ Số Vô Y',
  '水上驾星': 'Thủy Thượng Giá Tinh',
  '吉凶相伴': 'Cát Hung Tương Bạn',
  '枯木逢春': 'Khô Mộc Phùng Xuân',
};

const PATTERN_DESC_VI: Record<string, string> = {
  '君臣庆会': 'Tử Vi tọa Mệnh có Tả Phù, Hữu Bật đồng thủ hoặc hội chiếu — hình tượng Vua hiền gặp tôi giỏi phò tá, chủ đại phú đại quý, có tài thống lĩnh và quý nhân trợ lực suốt đời.',
  '紫府同宫': 'Tử Vi và Thiên Phủ đồng cung, Đế tinh và Tài khố tinh cùng hội tụ, chủ phẩm hạnh đoan chính, cơm áo sung túc, có tài lãnh đạo và quản trị lớn.',
  '府相朝垣': 'Thiên Phủ và Thiên Tướng phân cư Tam Phương Tứ Chính triều về Mệnh Cung — văn võ song toàn, quyền ấn tương hợp, cổ thư ca ngợi "Phủ Tướng triều viên thiên chung thực lộc", cả đời bổng lộc dồi dào.',
  '阳梁昌禄': 'Thái Dương, Thiên Lương, Văn Xương, Lộc Tồn tứ tinh hội chiếu Tam Phương cung Mệnh — đại quý cách về khoa cử, học thuật, nghiên cứu và công danh thanh hiển.',
  '火贪格': 'Tham Lang hội Hỏa Tinh tại Tam Phương Tứ Chính, chủ cơ vận bùng nổ bất ngờ, dễ đắc hoành tài hoặc bứt phá ngoạn mục trên thương trường; nên biết tiến biết giữ đúng lúc.',
  '铃贪格': 'Tham Lang hội Linh Tinh tại Tam Phương Tứ Chính, chủ nắm bắt thời cơ nhạy bén, phát đạt mạnh mẽ ngoài dự kiến, hợp khai mở lĩnh vực mới và tích lũy thành tài sản bền vững.',
  '武贪格': 'Vũ Khúc và Tham Lang đồng cung hoặc đối chiếu — cổ thư chép "Vũ Tham bất phát thiếu niên nhân", tiền vận rèn luyện bản lĩnh, từ sau tuổi 30 hậu vận phát phú quý lớn.',
  '杀破狼': 'Thất Sát, Phá Quân, Tham Lang tam phương hội hợp — cách cục của người tiên phong khai sáng, cuộc đời giàu bước ngoặt lớn, hợp khởi nghiệp, kinh doanh và lãnh đạo đổi mới.',
  '机月同梁': 'Thiên Cơ, Thái Âm, Thiên Đồng, Thiên Lương tứ tinh hội hợp tại Mệnh - Tài - Quan - Di, trí tuệ điềm đạm, giỏi mưu lược và tổ chức, rất hợp công chức, học thuật, y tế, tài chính.',
  '机月同梁三星会': 'Hội đủ 3 trong 4 sao Cơ - Nguyệt - Đồng - Lương tại Tam Phương Tứ Chính, mang khí chất nho nhã, giỏi hoạch định và chuyên môn ổn định.',
  '廉贞天相格': 'Liêm Trinh và Thiên Tướng đồng cung, tạo thành cách cục Ấn Thụ thanh liêm, xử việc công minh, hợp quản trị hành chính, pháp luật và điều hành tổ chức.',
  '武曲七杀': 'Vũ Khúc và Thất Sát đồng cung, Tướng tinh phối Tài tinh, hành sự quyết đoán, bản lĩnh tài chính và thực thi cực mạnh; cần lưu ý giữ gìn sức khỏe và sự mềm mỏng.',
  '天同天梁格': 'Thiên Đồng và Thiên Lương đồng cung, Phúc tinh hội Ấm tinh, tâm tính nhân hậu, điềm đạm, luôn có quý nhân che chở, hợp y dược, giáo dục, văn hóa và cố vấn.',
  '日月同宫': 'Thái Dương và Thái Âm đồng cung tại Sửu hoặc Mùi, Âm Dương hòa hợp, cương nhu tương tế, chủ danh lợi song thu và nhân duyên rộng mở.',
  '日月夹命': 'Thái Dương và Thái Âm phân cư hai cung giáp bên cạnh Mệnh Cung, nhật nguyệt chiếu sáng hai bên, cả đời nhiều quý nhân nâng đỡ, tài lộc và danh vị hanh thông.',
  '巨日同宫': 'Cự Môn và Thái Dương đồng cung tại Dần hoặc Thân — ánh sáng Thái Dương hóa giải ám khí của Cự Môn, chủ dùng tài hùng biện, ngoại ngữ, truyền thông hoặc luật pháp mà thành danh.',
  '石中隐玉': 'Cự Môn tọa Mệnh tại Tý hoặc Ngọ — "Ngọc ẩn trong đá", bề ngoài khiêm cung nhưng nội hàm uyên bác, càng trải nghiệm càng tỏa sáng rực rỡ ở trung và hậu vận.',
  '明珠出海': 'Mệnh vô chính diệu tại Mùi, đối cung Sửu có Thái Dương, Thái Âm đồng chiếu, tam phương hội Xương Khúc Phụ Bật — như ngọc minh châu vươn lên từ biển lớn, danh trấn bốn phương.',
  '紫微入命': 'Tử Vi độc tọa Mệnh Cung, mang khí chất Đế tinh độc lập, tự trọng cao và có tầm nhìn xa; nếu hội thêm Phụ Bật, Xương Khúc thì công danh hiển hách.',
  '辅弼夹命': 'Tả Phù và Hữu Bật phân cư hai cung giáp Mệnh, chủ hậu thuẫn quý nhân vững chắc, giỏi quy tụ nhân tâm và điều phối tập thể lớn.',
  '昌曲夹命': 'Văn Xương và Văn Khúc giáp Mệnh Cung, chủ thông tuệ hiếu học, văn tài lỗi lạc, thi cử và học thuật đều thuận lợi.',
  '魁钺夹命': 'Thiên Khôi và Thiên Việt giáp Mệnh Cung — Thiên Ất Quý Nhân hộ trì hai bên, gặp việc khó luôn có bậc trưởng bối hoặc quý nhân xuất hiện giúp đỡ.',
  '双禄朝垣': 'Hóa Lộc và Lộc Tồn cùng hội chiếu Tam Phương Tứ Chính của Mệnh Cung — cổ thư ca ngợi "Song Lộc triều viên, phú tỷ Đào Chu", nguồn tài lộc dồi dào, chính tài và hoành tài đều vượng.',
  '三奇加会': 'Hóa Lộc, Hóa Quyền, Hóa Khoa tam cát hóa cùng hội tụ tại Tam Phương Tứ Chính cung Mệnh — một trong những đại cát cách cao quý nhất, chủ danh vọng, quyền uy và tài lộc vẹn toàn.',
  '羊陀夹忌': 'Hóa Kỵ tọa Mệnh lại bị Kình Dương và Đà La giáp hai bên — nhắc nhở cần lấy sự nhẫn nại, tu dưỡng đạo đức và cẩn trọng trong các quyết định lớn để hóa giải trở lực.',
  '火铃夹命': 'Hỏa Tinh và Linh Tinh giáp Mệnh Cung, tính cách dễ nóng vội hoặc gặp biến động bất ngờ; cần rèn luyện tâm tĩnh lặng trước mọi việc.',
  '空劫夹命': 'Địa Không và Địa Kiếp giáp Mệnh Cung, tư duy phóng khoáng, khác biệt số đông, có duyên với triết học, nghệ thuật sáng tạo hoặc nghiên cứu chuyên sâu; cần quản lý tài chính chặt chẽ.',
  '廉杀羊': 'Liêm Trinh, Thất Sát, Kình Dương hội chiếu tam phương — nhắc nhở chú trọng an toàn đi lại, giữ hòa khí nhân sự và chăm sóc sức khỏe định kỳ.',
  '巨火羊': 'Cự Môn, Hỏa Tinh, Kình Dương hội chiếu — nhắc nhở cẩn trọng lời nói, giữ tâm bình hòa khi thương lượng để tránh xung đột không đáng có.',
  '铃昌陀武': 'Linh Tinh, Văn Xương, Đà La, Vũ Khúc hội hợp — khi đến đại hạn hoặc lưu niên cần cẩn trọng trong ký kết văn thư, tài chính và giữ vững tâm lý.',
  '马头带箭': 'Kình Dương tọa Mệnh tại Ngọ — "Mã đầu đới tiễn", tượng trưng cho ý chí đột phá mạnh mẽ, dám dấn thân nơi thử thách để lập công nghiệp lớn.',
  '禄存守命': 'Lộc Tồn tọa thủ Mệnh Cung, chủ cả đời cơm áo vững vàng, cẩn trọng, giỏi tích lũy tài sản và quản lý rủi ro.',
  '禄存守身': 'Lộc Tồn nhập Thân Cung, chủ hậu vận từ trung niên trở đi tài lộc sung túc, hưởng thành quả bền vững.',
  '天马入命': 'Thiên Mã tọa Mệnh, chủ cuộc đời năng động, "động trung cầu tài", càng đi xa hoặc mở rộng giao thương càng phát triển.',
  '天马在迁': 'Thiên Mã cư cung Thiên Di, xuất ngoại gặp nhiều cơ hội tốt, hợp lập nghiệp phương xa hoặc làm việc trong môi trường quốc tế.',
  '化禄入财': 'Chính tinh Hóa Lộc cư cung Tài Bạch, dòng tiền thông suốt, năng lực cốt lõi của ngôi sao Hóa Lộc chính là chìa khóa tạo dựng sự giàu có.',
  '化权入官': 'Chính tinh Hóa Quyền cư cung Quan Lộc, chủ bản lĩnh làm chủ công việc, có uy tín chuyên môn và năng lực nắm giữ vị trí trọng yếu.',
  '化科入命': 'Chính tinh Hóa Khoa nhập Mệnh Cung, chủ thanh danh tốt đẹp, học thức uyên bác và luôn có quý nhân kính trọng, nâng đỡ.',
  '化科入身': 'Chính tinh Hóa Khoa nhập Thân Cung, trung và hậu vận nổi tiếng nhờ uy tín, tri thức và đức độ.',
  '昌曲坐命': 'Văn Xương và Văn Khúc đồng tọa Mệnh Cung, tài hoa nghệ thuật và học thuật xuất chúng, ngôn từ thanh nhã.',
  '昌曲同会': 'Văn Xương và Văn Khúc cùng hội chiếu Tam Phương Tứ Chính, chủ thông minh, nhạy bén, lợi cho học hành, nghiên cứu và sáng tạo.',
  '辅弼同会': 'Tả Phù và Hữu Bật cùng hội chiếu Tam Phương Tứ Chính, chủ nhân duyên rộng mở, làm việc gì cũng có đồng đội và quý nhân sát cánh.',
  '魁钺同会': 'Thiên Khôi và Thiên Việt cùng hội chiếu Tam Phương Tứ Chính, chủ vận quý nhân cực vượng, dễ gặp cơ hội thăng tiến từ cấp trên và trưởng bối.',
  '科权双会': 'Hóa Khoa và Hóa Quyền cùng hội chiếu Tam Phương Tứ Chính — danh vọng đi đôi với thực quyền, rất hợp trở thành chuyên gia đầu ngành hoặc nhà quản lý cấp cao.',

  // Định Quý Cục / Định Phú Cục / Định Bần Tiện Cục / Định Tạp Cục (Toàn Thư)
  '日出扶桑': 'Thái Dương cư Mão thủ Mệnh hoặc cung Quan Lộc — mặt trời mọc phương Đông rạng rỡ, chủ chí hướng quang minh, công danh hiển đạt từ sớm.',
  '月落亥宫': 'Thái Âm cư Hợi thủ Mệnh (Nguyệt Lãng Thiên Môn) — ánh trăng sáng ngời nơi cổng trời, chủ tâm hồn thanh cao, phú quý song toàn, nhiều điền sản.',
  '月朗天门': 'Thái Âm cư Hợi thủ Mệnh — trăng sáng nơi cổng trời, chủ trí tuệ thanh nhã, tài lộc và điền sản dồi dào.',
  '月生沧海': 'Thái Âm cư Tý thủ cung Điền Trạch — trăng sáng trên biển lớn, chủ gia sản dồi dào, hậu vận điền trạch hưng vượng.',
  '辅弼拱主': 'Tử Vi thủ Mệnh được Tả Phù, Hữu Bật hội chiếu hoặc giáp Mệnh — Đế tinh có tả hữu phò tá đắc lực, chủ quyền quý và uy tín lớn.',
  '财印夹禄': 'Lộc Tồn thủ Mệnh hoặc Tài Bạch được Thiên Lương và Thiên Tướng giáp chiếu — chủ bổng lộc và uy tín song toàn.',
  '禄马佩印': 'Thiên Mã và Thiên Tướng đồng thủ Mệnh Cung hội Lộc Tồn / Hóa Lộc — vừa có ấn tín quyền hành vừa có tài lộc hanh thông.',
  '坐贵向贵': 'Thiên Khôi, Thiên Việt một sao tọa Mệnh, một sao ở đối cung xung chiếu — bước ra cửa gặp quý nhân, thi cử và sự nghiệp đều được bề trên nâng đỡ.',
  '马头带剑': 'Thiên Mã hội Kình Dương — chủ khí phách can trường, lập nghiệp nơi biên cương hoặc thương trường cạnh tranh.',
  '七杀朝斗': 'Thất Sát thủ Mệnh tại Dần, Thân, Tý, Ngọ — Cốt Tủy Phú ca ngợi "Thất Sát triều đẩu, tước lộc vinh xương", chủ uy quyền và bản lĩnh thống lĩnh.',
  '日月并明': 'Thái Dương cư Tỵ, Thái Âm cư Dậu, Mệnh tọa Tỵ hoặc Dậu — Nhật Nguyệt song huy chiếu mệnh, danh lợi đều sáng sủa.',
  '日月同临': 'Thái Dương và Thái Âm đồng cung thủ Mệnh, Âm Dương tương tế, tài quan song mỹ.',
  '刑囚夹印': 'Thiên Hình và Liêm Trinh đồng lâm Mệnh hoặc Thân cung — chủ khí phách võ dũng, kỷ luật nghiêm minh, hợp quân cảnh, pháp luật hoặc kỹ thuật.',
  '科权禄拱': 'Tam hóa Khoa, Quyền, Lộc hội tại tam phương của cung Mệnh — Tam Kỳ Gia Hội, danh vọng và tài quyền vẹn toàn.',
  '贪火相逢': 'Tham Lang và Hỏa Tinh đồng thủ Mệnh Cung ở thế Miếu Vượng — chủ bộc phát cơ nghiệp mạnh mẽ, danh chấn chư bang.',
  '武曲守垣': 'Vũ Khúc thủ Mệnh tại cung Mão — bản lĩnh cương nghị, quyết đoán, lập nghiệp vững chắc.',
  '紫府朝垣': 'Mệnh tọa Dần hoặc Thân có Tử Vi và Thiên Phủ đồng cung — bậc thượng cách phú quý song toàn, phúc thọ dồi dào.',
  '文星暗拱': 'Văn Xương và Văn Khúc hội hợp phò tá cung Mệnh — chủ tài hoa văn chương, học vấn uyên bác và khoa danh thuận lợi.',
  '权禄生逢': 'Hóa Quyền và Hóa Lộc đồng thủ Mệnh Cung ở thế Miếu Vượng — vừa có thực quyền vừa có tài lộc dồi dào.',
  '羊刃入庙': 'Kình Dương nhập miếu thủ Mệnh tại Tứ Mộ (Thìn, Tuất, Sửu, Mùi) gặp Cát tinh hội hợp — hóa sát vi quyền, uy dũng lập công.',
  '巨机居卯': 'Cự Môn và Thiên Cơ đồng cung thủ Mệnh tại cung Mão — tư duy sắc bén, khẩu tài xuất chúng, công danh rộng mở.',
  '明禄暗禄': 'Lộc Tồn thủ Mệnh (Minh Lộc), đối cung có Hóa Lộc xung chiếu (Ám Lộc) — Minh Lộc Ám Lộc cẩm thêm hoa, tài nguyên dồi dào cả chính tài lẫn quý nhân ngầm.',
  '科明暗禄': 'Mệnh Cung tọa Hóa Khoa (Khoa Minh), đối cung có Lộc Tồn xung chiếu (Ám Lộc) — thanh danh hiển đạt đi kèm phúc lộc bền vững.',
  '金舆扶驾': 'Tử Vi thủ Mệnh có Nhật Nguyệt và cát tinh phò tá — chủ quý hiển, được tập thể và quý nhân nâng đỡ.',
  '财荫夹印': 'Thiên Tướng thủ Mệnh hoặc Điền Trạch được Vũ Khúc (Tài tinh) và Thiên Lương (Ấm tinh) giáp chiếu — chủ phú quý và gia sản vững bền.',
  '日月夹财': 'Vũ Khúc thủ Mệnh hoặc Tài Bạch được Thái Dương và Thái Âm giáp hai bên — Nhật Nguyệt Giáp Tài, chủ tài khố vững bền, phú quý hưng vượng.',
  '财禄夹马': 'Thiên Mã thủ Mệnh được Vũ Khúc và Lộc Tồn giáp hai bên — động trung đắc tài, bôn ba lập nên đại nghiệp.',
  '荫印拱身': 'Thân cư Điền Trạch được Thiên Lương và Thiên Tướng hội chiếu, không phạm Không Vong — hậu vận cơ nghiệp và điền sản hưng vượng.',
  '日月照璧': 'Thái Dương và Thái Âm đồng lâm cung Điền Trạch tại Sửu hoặc Mùi — ánh sáng Nhật Nguyệt chiếu rọi gia trạch, chủ đại phú về bất động sản và cơ nghiệp gia đình.',
  '金灿光辉': 'Thái Dương độc tọa thủ Mệnh tại cung Ngọ (Nhật Lệ Trung Thiên) — mặt trời giữa trưa rực rỡ nhất, chủ quý hiển và danh vọng lớn.',
  '生不逢时': 'Mệnh Cung tọa Không Vong gặp sao Liêm Trinh đồng cung — nhắc nhở thời niên thiếu cần kiên trì rèn luyện, lấy chuyên môn thực chất để vượt qua thử thách.',
  '禄逢两杀': 'Lộc Tồn hoặc Hóa Lộc tại Mệnh gặp Không Vong lại hội Địa Không, Địa Kiếp — nhắc nhở quản lý tài chính cẩn trọng, tránh đầu cơ mạo hiểm.',
  '马落空亡': 'Thiên Mã thủ Mệnh gặp Không Vong — nhắc nhở khi di chuyển, đổi việc cần có kế hoạch rõ ràng để tránh bôn ba tốn sức.',
  '日月藏辉': 'Nhật Nguyệt lạc hãm lại gặp Cự Môn hãm địa tại Tam Phương Tứ Chính — nhắc nhở giữ tâm khiêm hòa, tránh tranh biện thị phi và chú trọng dưỡng sinh.',
  '财与囚仇': 'Vũ Khúc (Tài tinh) và Liêm Trinh (Tù tinh) phân thủ Mệnh và Thân cung — nhắc nhở tách bạch rõ ràng giữa tài chính và pháp lý, tránh tranh chấp tiền bạc.',
  '一生孤贫': 'Phá Quân thủ Mệnh tại cung lạc hãm — cuộc đời nhiều biến động đổi thay, cần rèn luyện tay nghề chuyên sâu và tích lũy bền bỉ.',
  '君子在野': 'Mệnh Cung hội nhiều Tứ Sát (Dương, Đà, Hỏa, Linh) — nhắc nhở lấy đức độ và sự điềm tĩnh để hóa giải xung lực, làm việc trong khuôn khổ kỷ luật.',
  '两重华盖': 'Lộc Tồn và Hóa Lộc đồng tọa Mệnh gặp Địa Không, Địa Kiếp — có duyên sâu với triết học, nghiên cứu hoặc tâm linh; cần giữ kỷ luật quản lý tài sản.',
  '风云际会': 'Bản mệnh và Thân cung tuy bình thường nhưng khi bước vào Đại Hạn hội hợp Lộc Tồn, Hóa Lộc và Thiên Mã — gặp thời vận lớn mà bứt phá thành công.',
  '锦上添花': 'Đại hạn tuy có sát tinh tọa thủ nhưng bản cung vững vàng, tam phương hội nhiều cát tinh — vượt qua thử thách để gặt hái thành tựu rực rỡ.',
  '禄衰马困': 'Đại hạn hội Thất Sát mà Lộc Tồn và Thiên Mã đều rơi vào Không Vong — nhắc nhở giai đoạn này nên thủ vững, tránh mở rộng đầu tư mạo hiểm.',
  '衣锦还乡': 'Sau tuổi 40 bước vào đại hạn tại Tứ Mộ (Sửu, Thìn, Mùi, Tuất) — trung và hậu vận tích lũy thành tựu vẻ vang, công thành danh toại.',
  '步数无依': 'Hai đại hạn liên tiếp rơi vào cung vị thiếu chính tinh đắc địa — giai đoạn cần dựa vào nội lực và sự kiên trì bền bỉ.',
  '水上驾星': 'Vận trình lưu niên biến đổi luân phiên giữa năm thuận lợi và năm thử thách — cần giữ nhịp độ ổn định, tiến thoái đúng thời.',
  '吉凶相伴': 'Mệnh cung có chính tinh tọa thủ, gặp đại hạn cát lợi thì phát đạt mạnh mẽ, gặp hạn suy thì nên tĩnh dưỡng giữ mình.',
  '枯木逢春': 'Mệnh cung tiên thiên tuy kém lực nhưng bước vào đại hạn đắc cách hội nhiều cát tinh — như cây khô gặp mùa xuân, vận thế khởi sắc rực rỡ.',
};

const EXACT_CONDITION_VI: Record<string, string> = {
  // Required conditions
  '紫微入命': 'Tử Vi nhập Mệnh Cung',
  '左辅右弼同会三方四正': 'Tả Phù, Hữu Bật đồng hội Tam Phương Tứ Chính',
  '紫微天府同入命宫': 'Tử Vi, Thiên Phủ cùng nhập Mệnh Cung',
  '紫微天府同宫（不在命宫，会照减力）': 'Tử Vi, Thiên Phủ đồng cung (không tọa Mệnh, hội chiếu giảm lực)',
  '天府坐命三方': 'Thiên Phủ tọa Tam Phương cung Mệnh',
  '天相坐命三方': 'Thiên Tướng tọa Tam Phương cung Mệnh',
  '两星不同宫': 'Hai sao phân cư khác cung',
  '太阳会命宫三方': 'Thái Dương hội Tam Phương cung Mệnh',
  '天梁会命宫三方': 'Thiên Lương hội Tam Phương cung Mệnh',
  '文昌会命宫三方': 'Văn Xương hội Tam Phương cung Mệnh',
  '禄存会命宫三方': 'Lộc Tồn hội Tam Phương cung Mệnh',
  '贪狼同宫火星': 'Tham Lang đồng cung Hỏa Tinh',
  '贪狼会照火星': 'Tham Lang hội chiếu Hỏa Tinh',
  '贪狼同宫铃星': 'Tham Lang đồng cung Linh Tinh',
  '贪狼会照铃星': 'Tham Lang hội chiếu Linh Tinh',
  '贪狼会照命宫三方': 'Tham Lang hội chiếu Tam Phương cung Mệnh',
  '武曲贪狼同宫（丑/未）': 'Vũ Khúc, Tham Lang đồng cung (Sửu/Mùi)',
  '武曲贪狼对宫拱照': 'Vũ Khúc, Tham Lang đối cung xung chiếu',
  '会照命宫三方': 'Hội chiếu Tam Phương cung Mệnh',
  '七杀、破军、贪狼三星齐入命宫三方四正': 'Thất Sát, Phá Quân, Tham Lang cùng hội Tam Phương Tứ Chính cung Mệnh',
  '天机、太阴、天同、天梁四星齐入命宫三方四正': 'Thiên Cơ, Thái Âm, Thiên Đồng, Thiên Lương cùng hội Tam Phương Tứ Chính cung Mệnh',
  '廉贞天相同宫': 'Liêm Trinh, Thiên Tướng đồng cung',
  '武曲七杀同宫': 'Vũ Khúc, Thất Sát đồng cung',
  '天同天梁同宫': 'Thiên Đồng, Thiên Lương đồng cung',
  '太阳太阴同入丑宫': 'Thái Dương, Thái Âm cùng nhập cung Sửu',
  '太阳太阴同入未宫': 'Thái Dương, Thái Âm cùng nhập cung Mùi',
  '太阳太阴分居命宫前后两宫': 'Thái Dương, Thái Âm phân cư hai cung giáp Mệnh',
  '巨门太阳同入寅宫': 'Cự Môn, Thái Dương cùng nhập cung Dần',
  '巨门太阳同入申宫': 'Cự Môn, Thái Dương cùng nhập cung Thân',
  '巨门入命于子宫': 'Cự Môn nhập Mệnh tại cung Tý',
  '巨门入命于午宫': 'Cự Môn nhập Mệnh tại cung Ngọ',
  '命宫在未为空宫': 'Mệnh Cung tại Mùi Vô Chính Diệu',
  '对宫丑宫为太阳太阴同度': 'Đối cung Sửu có Thái Dương, Thái Âm đồng cung',
  '紫微独坐命宫（无天府同坐）': 'Tử Vi độc tọa Mệnh Cung (không đồng cung Thiên Phủ)',
  '左辅右弼分居命宫前后两宫': 'Tả Phù, Hữu Bật phân cư hai cung giáp Mệnh',
  '文昌文曲分居命宫前后两宫': 'Văn Xương, Văn Khúc phân cư hai cung giáp Mệnh',
  '天魁天钺分居命宫前后两宫': 'Thiên Khôi, Thiên Việt phân cư hai cung giáp Mệnh',
  '化禄会照三方四正': 'Hóa Lộc hội chiếu Tam Phương Tứ Chính',
  '禄存会照三方四正': 'Lộc Tồn hội chiếu Tam Phương Tứ Chính',
  '化禄、化权、化科三吉化齐会命宫三方四正': 'Hóa Lộc, Hóa Quyền, Hóa Khoa cùng hội Tam Phương Tứ Chính cung Mệnh',
  '化忌坐命': 'Hóa Kỵ tọa Mệnh Cung',
  '擎羊陀罗分居命宫前后两宫': 'Kình Dương, Đà La phân cư hai cung giáp Mệnh',
  '火星铃星分居命宫前后两宫': 'Hỏa Tinh, Linh Tinh phân cư hai cung giáp Mệnh',
  '地空地劫分居命宫前后两宫': 'Địa Không, Địa Kiếp phân cư hai cung giáp Mệnh',
  '廉贞、七杀、擎羊三星会照三方四正': 'Liêm Trinh, Thất Sát, Kình Dương hội chiếu Tam Phương Tứ Chính',
  '巨门、火星、擎羊三星会照三方四正': 'Cự Môn, Hỏa Tinh, Kình Dương hội chiếu Tam Phương Tứ Chính',
  '铃星、文昌、陀罗、武曲四星会照三方四正': 'Linh Tinh, Văn Xương, Đà La, Vũ Khúc hội chiếu Tam Phương Tứ Chính',
  '擎羊于午宫坐命': 'Kình Dương tọa Mệnh tại cung Ngọ',
  '禄存入命宫': 'Lộc Tồn nhập Mệnh Cung',
  '禄存入身宫': 'Lộc Tồn nhập Thân Cung',
  '天马入命宫': 'Thiên Mã nhập Mệnh Cung',
  '天马入迁移宫': 'Thiên Mã nhập cung Thiên Di',
  '文昌、文曲同会命宫三方四正': 'Văn Xương, Văn Khúc đồng hội Tam Phương Tứ Chính cung Mệnh',
  '左辅、右弼同会命宫三方四正': 'Tả Phù, Hữu Bật đồng hội Tam Phương Tứ Chính cung Mệnh',
  '天魁、天钺同会命宫三方四正': 'Thiên Khôi, Thiên Việt đồng hội Tam Phương Tứ Chính cung Mệnh',
  '化科、化权同会命宫三方四正': 'Hóa Khoa, Hóa Quyền đồng hội Tam Phương Tứ Chính cung Mệnh',

  // Bonus conditions
  '再会文昌或文曲': 'Hội thêm Văn Xương hoặc Văn Khúc',
  '魁钺贵人加照': 'Có Thiên Khôi, Thiên Việt quý nhân hội chiếu',
  '紫微化权': 'Tử Vi Hóa Quyền',
  '左辅右弼同会': 'Tả Phù, Hữu Bật đồng hội',
  '再会昌曲': 'Hội thêm Văn Xương, Văn Khúc',
  '命宫见禄': 'Mệnh Cung đắc Lộc (Lộc Tồn / Hóa Lộc)',
  '再会左辅': 'Hội thêm Tả Phù',
  '太阳庙旺': 'Thái Dương đắc Miếu Vượng',
  '天梁庙旺': 'Thiên Lương đắc Miếu Vượng',
  '再会化科': 'Hội thêm Hóa Khoa',
  '贪狼庙旺': 'Tham Lang đắc Miếu Vượng',
  '贪狼化禄/化权': 'Tham Lang Hóa Lộc / Hóa Quyền',
  '再遇火星/铃星（火贪/铃贪叠加）': 'Gặp thêm Hỏa Tinh / Linh Tinh (Hỏa Tham / Linh Tham chồng cách)',
  '武曲化禄': 'Vũ Khúc Hóa Lộc',
  '三方有化禄或化权（动得有力）': 'Tam phương có Hóa Lộc hoặc Hóa Quyền (biến động đắc lực)',
  '辅弼同会（变动中得贵人）': 'Tả Phù, Hữu Bật đồng hội (trong biến động có quý nhân trợ lực)',
  '见禄存或廉贞化禄': 'Gặp Lộc Tồn hoặc Liêm Trinh Hóa Lộc',
  '左辅会照': 'Tả Phù hội chiếu',
  '武曲化权': 'Vũ Khúc Hóa Quyền',
  '文昌会照': 'Văn Xương hội chiếu',
  '天同化禄': 'Thiên Đồng Hóa Lộc',
  '未宫日月同辉（古书云未宫日月双美）': 'Nhật Nguyệt đồng huy tại cung Mùi (cổ thư ca ngợi cung Mùi Nhật Nguyệt song mỹ)',
  '昌曲会照': 'Văn Xương, Văn Khúc hội chiếu',
  '太阴庙旺': 'Thái Âm đắc Miếu Vượng',
  '寅宫太阳庙旺，巨门得日光化解是非': 'Thái Dương cư Dần Miếu Vượng, ánh dương hóa giải thị phi của Cự Môn',
  '巨门化禄/化权（口才生财）': 'Cự Môn Hóa Lộc / Hóa Quyền (khẩu tài sinh tài)',
  '巨门化禄/化权': 'Cự Môn Hóa Lộc / Hóa Quyền',
  '文昌会照（石中隐玉得明）': 'Văn Xương hội chiếu (ngọc ẩn trong đá tỏa sáng)',
  '辅弼相助': 'Tả Phù, Hữu Bật tương trợ',
  '文昌文曲同会': 'Văn Xương, Văn Khúc đồng hội',
  '再会魁钺': 'Hội thêm Thiên Khôi, Thiên Việt',
  '再会七杀或破军（武职大贵）': 'Hội thêm Thất Sát hoặc Phá Quân (võ chức đại quý)',
  '魁钺加照': 'Thiên Khôi, Thiên Việt gia chiếu',

  // Breaking conditions
  '地空地劫双夹会照（紫微忌空劫）': 'Địa Không, Địa Kiếp giáp hoặc hội chiếu (Tử Vi kỵ Không Kiếp)',
  '紫府宫坐空劫（破紫府之贵气）': 'Cung Tử Phủ tọa Không Kiếp (làm giảm quý khí)',
  '紫府宫见双煞同坐': 'Cung Tử Phủ gặp song sát đồng tọa',
  '命宫坐煞星': 'Mệnh Cung tọa sát tinh',
  '三方四正煞星过多': 'Tam Phương Tứ Chính hội nhiều sát tinh',
  '太阳落陷（阳梁失辉）': 'Thái Dương lạc hãm (Dương Lương giảm quang huy)',
  '三方煞重': 'Tam phương sát tinh nặng',
  '贪狼宫又见羊陀（破横发之力）': 'Cung Tham Lang gặp thêm Kình Dương, Đà La (giảm lực hoành phát)',
  '贪狼遇空劫（财来财去）': 'Tham Lang gặp Không Kiếp (tài lộc tụ tán thất thường)',
  '武贪宫见羊陀': 'Cung Vũ Tham gặp Kình Dương, Đà La',
  '武贪宫遇空劫': 'Cung Vũ Tham gặp Địa Không, Địa Kiếp',
  '煞星过重（动而无成）': 'Sát tinh quá nặng (bôn ba vất vả)',
  '命坐空劫（动得辛苦）': 'Mệnh tọa Không Kiếp (khai sáng nhiều thử thách)',
  '煞星过多（机月同梁忌煞）': 'Sát tinh nhiều (Cơ Nguyệt Đồng Lương kỵ sát tinh)',
  '命宫坐煞': 'Mệnh Cung tọa sát tinh',
  '廉相宫坐擎羊（廉杀羊倾向）': 'Cung Liêm Tướng tọa Kình Dương',
  '廉贞化忌': 'Liêm Trinh Hóa Kỵ',
  '武曲化忌（武曲化忌为财劫之兆）': 'Vũ Khúc Hóa Kỵ (cần cẩn trọng hao tài)',
  '武杀宫煞星过多': 'Cung Vũ Sát hội nhiều sát tinh',
  '煞星同坐': 'Sát tinh đồng tọa',
  '日月宫煞星同坐': 'Cung Nhật Nguyệt có sát tinh đồng tọa',
  '日月落陷（夹命无光）': 'Nhật Nguyệt lạc hãm (giáp Mệnh kém sáng)',
  '巨门化忌（口舌官非）': 'Cự Môn Hóa Kỵ (lưu ý thị phi lời nói)',
  '申宫太阳偏西，巨门暗曜更显': 'Thái Dương cư Thân xế bóng, ám khí Cự Môn rõ hơn',
  '巨门化忌（玉藏深泥）': 'Cự Môn Hóa Kỵ (ngọc ẩn bùn sâu, cần kiên nhẫn)',
  '命坐煞星': 'Mệnh Cung tọa sát tinh',
  '煞星会照（珠光黯淡）': 'Sát tinh hội chiếu (làm giảm ánh sáng minh châu)',
  '无辅弼（孤君无臣）': 'Thiếu Tả Phù, Hữu Bật (Cô Quân vô thần)',
  '紫微遇空劫（古书最忌）': 'Tử Vi gặp Địa Không, Địa Kiếp',
  '命坐空劫（双禄遇空，财来财去）': 'Mệnh tọa Không Kiếp (Song Lộc gặp Không, cần giữ kho chặt chẽ)',

  // Quanshu Strict Notes (41 judgeable patterns + 8 Định Tạp Cục)
  '不坐空亡，遇逢本宫有吉星是也': 'Mệnh Cung không phạm Không Vong, bản cung có Cát tinh hội tụ',
  '日在卯守命是也，守官禄宫亦然': 'Thái Dương cư Mão thủ Mệnh Cung hoặc thủ cung Quan Lộc',
  '月在亥守命是也，又名月朗天门': 'Thái Âm cư Hợi thủ Mệnh Cung, còn gọi là Nguyệt Lãng Thiên Môn',
  '月在子宫守田宅是也': 'Thái Âm cư Tý thủ cung Điền Trạch',
  '紫微守命，二星来拱是也，夹之亦然': 'Tử Vi thủ Mệnh, Tả Phù và Hữu Bật hội chiếu hoặc giáp Mệnh',
  '紫微左右同守命是也，更会相武阴妙上': 'Tử Vi cùng Tả Phù, Hữu Bật đồng thủ Mệnh Cung; hội thêm Thiên Tướng, Vũ Khúc, Thái Âm càng thượng cách',
  '禄守命，梁相来夹是也，入财亦然': 'Lộc thủ Mệnh hoặc Tài Bạch, Thiên Lương và Thiên Tướng giáp hai bên',
  '马前有禄，印星同宫是也': 'Thiên Mã thủ Mệnh có Lộc Tồn / Hóa Lộc đồng cung hoặc liền kề, đồng thời Thiên Tướng (Ấn tinh) đồng cung',
  '谓魁钺在命迭相坐拱是也': 'Thiên Khôi, Thiên Việt một sao tọa Mệnh Cung, một sao ở đối cung xung chiếu',
  '谓马有刃是也，不是居午格': 'Thiên Mã hội Kình Dương',
  '见前批注。〈骨髓赋〉：「七杀朝斗，爵禄荣昌」': 'Thất Sát thủ Mệnh tại Dần, Thân, Tý, Ngọ (Cốt Tủy Phú: Thất Sát triều đẩu, tước lộc vinh xương)',
  '见前批注。通行解：太阳在巳、太阴在酉，命坐巳或酉': 'Thái Dương cư Tỵ, Thái Âm cư Dậu, Mệnh Cung tọa tại Tỵ hoặc Dậu',
  '见前批注。命未空宫，对宫丑日月同度拱照': 'Mệnh Cung tại Mùi Vô Chính Diệu, đối cung Sửu có Thái Dương và Thái Âm đồng cung xung chiếu',
  '见前批注。日月同宫守命': 'Thái Dương và Thái Âm đồng cung thủ Mệnh',
  '天刑廉贞同临身命，主武勇之人': 'Thiên Hình và Liêm Trinh đồng lâm Mệnh hoặc Thân Cung, chủ người võ dũng quyết đoán',
  '见前批注。科权禄三化会命三方': 'Tam hóa Khoa, Quyền, Lộc hội tại tam phương của cung Mệnh',
  '见前批注. 科权禄三化会命三方': 'Tam hóa Khoa, Quyền, Lộc hội tại tam phương của cung Mệnh',
  '谓二星守命同居庙旺是也': 'Tham Lang và Hỏa Tinh đồng thủ Mệnh Cung và cùng đắc Miếu Vượng',
  '武守命卯宫是也，余不是': 'Vũ Khúc thủ Mệnh tại cung Mão',
  '见前批注。命寅申，府相分居财帛、官禄朝命': 'Mệnh tọa Dần hoặc Thân, Thiên Phủ và Thiên Tướng phân cư cung Tài Bạch và Quan Lộc triều về Mệnh',
  '见前批注。命坐寅申，紫府同宫': 'Mệnh tọa Dần hoặc Thân, Tử Vi và Thiên Phủ đồng cung',
  '见前批注。昌曲夹命（暗拱）': 'Văn Xương và Văn Khúc giáp Mệnh Cung',
  '二星守命庙旺是也，陷不是': 'Hóa Quyền và Hóa Lộc đồng thủ Mệnh Cung ở thế Miếu Vượng (không lạc hãm)',
  '辰戌丑未守命遇吉是也': 'Kình Dương nhập miếu thủ Mệnh tại Thìn, Tuất, Sửu, Mùi gặp Cát tinh hội hợp',
  '见前批注。巨门天机同宫卯守命': 'Cự Môn và Thiên Cơ đồng cung thủ Mệnh tại cung Mão',
  '见前批注。禄存守命（明），对宫化禄（暗）': 'Lộc Tồn thủ Mệnh (Minh Lộc), đối cung có Hóa Lộc xung chiếu (Ám Lộc)',
  '见前批注（所指赋句不明，通行注家有二解）': 'Mệnh Cung tọa Hóa Khoa (Khoa Minh), đối cung có Lộc Tồn xung chiếu (Ám Lộc)',
  '紫微守命，前后有日月来夹是也': 'Tử Vi thủ Mệnh, hai bên có Nhật Nguyệt giáp chiếu',
  '相守命，武梁来夹是也，田宅宫亦然': 'Thiên Tướng thủ Mệnh hoặc Điền Trạch, Vũ Khúc và Thiên Lương giáp hai bên',
  '武守命，日月来夹是也，财帛宫亦然': 'Vũ Khúc thủ Mệnh hoặc Tài Bạch, Thái Dương và Thái Âm giáp hai bên',
  '马守命，武禄来夹是也，逢生旺尤妙': 'Thiên Mã thủ Mệnh, Vũ Khúc và Lộc Tồn giáp hai bên',
  '身临田宅，梁相拱冲是也，勿坐空亡': 'Thân cư Điền Trạch, Thiên Lương và Thiên Tướng hội chiếu, không phạm Không Vong',
  '日月临田宅宫是也，喜居墓库': 'Thái Dương và Thái Âm đồng lâm cung Điền Trạch tại Tứ Mộ (Sửu, Mùi)',
  '太阳单守，命在午宫是也': 'Thái Dương độc tọa thủ Mệnh tại cung Ngọ',
  '命坐空亡逢廉贞是也': 'Mệnh Cung tọa Không Vong gặp sao Liêm Trinh đồng cung',
  '禄坐空亡又逢空劫杀星是也': 'Lộc Tồn hoặc Hóa Lộc tọa Mệnh gặp Không Vong lại hội Địa Không, Địa Kiếp',
  '马既落亡，虽禄冲会无用，主奔波': 'Thiên Mã thủ Mệnh gặp Không Vong đồng cung',
  '日月反背又逢巨暗是也': 'Nhật Nguyệt lạc hãm lại gặp Cự Môn hãm địa tại Tam Phương Tứ Chính',
  '武贞同守身命是也': 'Vũ Khúc và Liêm Trinh phân thủ Mệnh Cung và Thân Cung',
  '谓破守命星陷地是也': 'Phá Quân thủ Mệnh tại cung lạc hãm',
  '谓四杀守身命而言临陷地是也': 'Mệnh Cung hội nhiều Tứ Sát (Kình Dương, Đà La, Hỏa Tinh, Linh Tinh) ở thế lạc hãm',
  '谓禄存化禄坐命遇空劫是也': 'Lộc Tồn và Hóa Lộc đồng tọa Mệnh Cung gặp Địa Không, Địa Kiếp',
  // Định Tạp Cục (8 vận hạn cách cục)
  '身命虽弱二限逢禄马是也': 'Mệnh và Thân cung tuy yếu nhưng đại hạn hội Lộc Tồn / Hóa Lộc và Thiên Mã',
  '谓限破恶星而行吉地是也': 'Cung đại hạn tuy có sát tinh nhưng bản cung vững vàng và tam phương hội nhiều cát tinh',
  '限逢七杀禄马空亡是也': 'Tam phương đại hạn gặp Thất Sát, đồng thời Lộc Tồn và Thiên Mã đều tọa Không Vong',
  '少年不遂四十后行墓运是也': 'Từ sau 40 tuổi đại hạn đi vào các cung Tứ Mộ (Sửu, Thìn, Mùi, Tuất)',
  '前限接后限连绵不分是也': 'Hai đại hạn liên tiếp đều rơi vào cung vị yếu (vô chính diệu hoặc chính tinh lạc hãm)',
  '一年好一年不好是也': 'Vận hạn lưu niên hai năm liên tiếp chuyển đổi giữa Cát và Hung',
  '命有主星限前则发限衰不发是也': 'Mệnh cung có chính tinh tọa thủ, đại hạn vượng và hội cát tinh thì phát đạt',
  '谓命衰限好是也': 'Mệnh cung tiên thiên tuy yếu nhưng bước vào đại hạn vượng địa và hội nhiều cát tinh',
};

const EXACT_SOURCE_VI: Record<string, string> = {
  '《紫微斗数全书》': 'Tử Vi Đẩu Số Toàn Thư',
  '《紫微斗数骨髓赋》': 'Tử Vi Đẩu Số Cốt Tủy Phú',
  '《紫微斗数全书·君臣庆会格》': 'Tử Vi Đẩu Số Toàn Thư · Quân Thần Khánh Hội Cách',
  '《紫微斗数全书·紫府同宫格》': 'Tử Vi Đẩu Số Toàn Thư · Tử Phủ Đồng Cung Cách',
  '《紫微斗数全书·府相朝垣格》': 'Tử Vi Đẩu Số Toàn Thư · Phủ Tướng Triều Viên Cách',
  '《紫微斗数全书·阳梁昌禄格》': 'Tử Vi Đẩu Số Toàn Thư · Dương Lương Xương Lộc Cách',
  '《紫微斗数全书·杀破狼》': 'Tử Vi Đẩu Số Toàn Thư · Sát Phá Lang',
  '《紫微斗数全书·机月同梁格》': 'Tử Vi Đẩu Số Toàn Thư · Cơ Nguyệt Đồng Lương Cách',
  '《紫微斗数全书·日月夹命》': 'Tử Vi Đẩu Số Toàn Thư · Nhật Nguyệt Giáp Mệnh',
  '《紫微斗数全书·巨日同宫》': 'Tử Vi Đẩu Số Toàn Thư · Cự Nhật Đồng Cung',
  '《紫微斗数骨髓赋·石中隐玉》': 'Tử Vi Đẩu Số Cốt Tủy Phú · Thạch Trung Ẩn Ngọc',
  '《紫微斗数全集·明珠出海》': 'Tử Vi Đẩu Số Toàn Tập · Minh Châu Xuất Hải',
  '《紫微斗数全书·辅弼夹命》': 'Tử Vi Đẩu Số Toàn Thư · Phụ Bật Giáp Mệnh',
  '《紫微斗数全书·双禄朝垣》': 'Tử Vi Đẩu Số Toàn Thư · Song Lộc Triều Viên',
  '《紫微斗数全书·三奇加会》': 'Tử Vi Đẩu Số Toàn Thư · Tam Kỳ Gia Hội',
  '《紫微斗数骨髓赋·羊陀夹忌》': 'Tử Vi Đẩu Số Cốt Tủy Phú · Dương Đà Giáp Kỵ',
  '《紫微斗数全书·廉杀羊》': 'Tử Vi Đẩu Số Toàn Thư · Liêm Sát Dương',
  '《紫微斗数骨髓赋·巨火羊》': 'Tử Vi Đẩu Số Cốt Tủy Phú · Cự Hỏa Dương',
  '《紫微斗数骨髓赋·铃昌陀武》': 'Tử Vi Đẩu Số Cốt Tủy Phú · Linh Xương Đà Vũ',
  '《紫微斗数骨髓赋·马头带箭》': 'Tử Vi Đẩu Số Cốt Tủy Phú · Mã Đầu Đới Tiễn',
  '《紫微斗数全书·禄存星》': 'Tử Vi Đẩu Số Toàn Thư · Lộc Tồn Tinh',
  '《紫微斗数全书·天马星》': 'Tử Vi Đẩu Số Toàn Thư · Thiên Mã Tinh',
  '《紫微斗数全书·四化论》': 'Tử Vi Đẩu Số Toàn Thư · Tứ Hóa Luận',
  '《紫微斗数全书·文星论》': 'Tử Vi Đẩu Số Toàn Thư · Văn Tinh Luận',
  '《紫微斗数全书·辅弼论》': 'Tử Vi Đẩu Số Toàn Thư · Phụ Bật Luận',
  '《紫微斗数全书·魁钺论》': 'Tử Vi Đẩu Số Toàn Thư · Khôi Việt Luận',
  '《紫微斗数全书·四化会照》': 'Tử Vi Đẩu Số Toàn Thư · Tứ Hóa Hội Chiếu',
};

function mapQuanshuTableName(table: string): string {
  if (table === '定贵局' || table === '定局') return 'Định Quý Cục';
  if (table === '定富局') return 'Định Phú Cục';
  if (table === '定贫贱局') return 'Định Bần Tiện Cục';
  if (table === '定杂局') return 'Định Tạp Cục';
  return 'Định Quý Cục';
}

export function translateChineseTextFragment(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (EXACT_CONDITION_VI[trimmed]) return EXACT_CONDITION_VI[trimmed];
  if (EXACT_SOURCE_VI[trimmed]) return EXACT_SOURCE_VI[trimmed];

  // Handle Quanshu strict condition format: 《全书》定贵局第16条：...
  const quanshuReqMatch = trimmed.match(/^《?全书》?(定贵局|定富局|定贫贱局|定杂局|定局)第(\d+)条[：:]\s*(.+)$/);
  if (quanshuReqMatch) {
    const [, table, no, note] = quanshuReqMatch;
    const tableVi = mapQuanshuTableName(table);
    const cleanNote = note.trim();
    const noteVi = EXACT_CONDITION_VI[cleanNote] || translateChineseTextFragment(cleanNote);
    return `Tử Vi Đẩu Số Toàn Thư, phần ${tableVi}, điều ${no}: ${noteVi}`;
  }

  // Handle Quanshu strict source format: 《紫微斗数全书·卷一·定贵局》第16条
  const quanshuSrcMatch = trimmed.match(/^《?紫微斗数全书·卷一·(定贵局|定富局|定贫贱局|定杂局|定局)》?第(\d+)条$/);
  if (quanshuSrcMatch) {
    const [, table, no] = quanshuSrcMatch;
    const tableVi = mapQuanshuTableName(table);
    return `Tử Vi Đẩu Số Toàn Thư, phần ${tableVi}, điều ${no}`;
  }

  // Handle Quanshu strict description format: 原书第16条：「...」〔...〕
  const quanshuDescMatch = trimmed.match(/^原书第(\d+)条[：:]\s*「(.+)」(〔.+〕)?$/);
  if (quanshuDescMatch) {
    const [, no, note, disputedTag] = quanshuDescMatch;
    const cleanNote = note.trim();
    const noteVi = EXACT_CONDITION_VI[cleanNote] || translateChineseTextFragment(cleanNote);
    const tagVi = disputedTag ? ' (Chú giải cổ thư có nhiều cách hiểu, xét theo chuẩn thông hành)' : '';
    return `Luận giải Toàn Thư (điều ${no}): ${noteVi}.${tagVi}`;
  }

  // Handle dynamic JiYueTongLiangPartial required: 三方四正会...（机月同梁缺...）
  const jytlMatch = trimmed.match(/^三方四正会(.+)（机月同梁缺(.+)）$/);
  if (jytlMatch) {
    const hasStars = jytlMatch[1].split('、').map((s) => translateStarName(s)).join(', ');
    const missStars = jytlMatch[2].split('、').map((s) => translateStarName(s)).join(', ');
    return `Tam Phương Tứ Chính hội ${hasStars} (Cơ Nguyệt Đồng Lương khuyết ${missStars})`;
  }

  // Handle dynamic Sihua required strings: ${star}化禄坐命宫, etc.
  const sihuaReqMatch = trimmed.match(/^(.+)化(禄|权|科|忌)(坐|入)(命宫|身宫|命|身|迁宫|迁移宫|财帛宫|官禄宫)$/);
  if (sihuaReqMatch) {
    const [, star, hua, verb, pal] = sihuaReqMatch;
    const starVi = translateStarName(star);
    const huaVi = translateSiHua(hua);
    const verbVi = verb === '坐' ? 'tọa' : 'nhập';
    const palMap: Record<string, string> = {
      '命宫': 'Mệnh Cung',
      '命': 'Mệnh Cung',
      '身宫': 'Thân Cung',
      '身': 'Thân Cung',
      '迁宫': 'cung Thiên Di',
      '迁移宫': 'cung Thiên Di',
      '财帛宫': 'cung Tài Bạch',
      '官禄宫': 'cung Quan Lộc',
    };
    return `Sao ${starVi} Hóa ${huaVi} ${verbVi} ${palMap[pal] || translatePalaceName(pal)}`;
  }

  let out = trimmed;
  const replacements: [string, string][] = [
    ['《紫微斗数全书·卷一·定贵局》', 'Tử Vi Đẩu Số Toàn Thư, phần Định Quý Cục'],
    ['《紫微斗数全书·卷一·定富局》', 'Tử Vi Đẩu Số Toàn Thư, phần Định Phú Cục'],
    ['《紫微斗数全书·卷一·定贫贱局》', 'Tử Vi Đẩu Số Toàn Thư, phần Định Bần Tiện Cục'],
    ['《紫微斗数全书·卷一·定杂局》', 'Tử Vi Đẩu Số Toàn Thư, phần Định Tạp Cục'],
    ['《紫微斗数全书', 'Tử Vi Đẩu Số Toàn Thư'],
    ['《紫微斗数骨髓赋', 'Tử Vi Đẩu Số Cốt Tủy Phú'],
    ['《紫微斗数全集', 'Tử Vi Đẩu Số Toàn Tập'],
    ['〔存疑格：注文歧义，按最通行读法判定〕', ' (Xét theo chú giải thông hành)'],
    ['见前批注。科权禄三化会命三方', 'Tam hóa Khoa, Quyền, Lộc hội tại tam phương của cung Mệnh'],
    ['见前批注. 科权禄三化会命三方', 'Tam hóa Khoa, Quyền, Lộc hội tại tam phương của cung Mệnh'],
    ['科权禄三化会命三方', 'Tam hóa Khoa, Quyền, Lộc hội tại tam phương của cung Mệnh'],
    ['见前批注。', ''],
    ['见前批注.', ''],
    ['三方四正', 'Tam Phương Tứ Chính'],
    ['命宫三方', 'Tam Phương cung Mệnh'],
    ['会命三方', 'hội tại tam phương của cung Mệnh'],
    ['同入命宫', 'cùng nhập Mệnh Cung'],
    ['同入', 'cùng nhập '],
    ['分居命宫前后两宫', 'phân cư hai cung giáp Mệnh'],
    ['会照', 'hội chiếu '],
    ['同会', 'đồng hội '],
    ['同宫', 'đồng cung '],
    ['独坐', 'độc tọa '],
    ['入命于', 'nhập Mệnh tại '],
    ['入命', 'nhập Mệnh'],
    ['坐命', 'tọa Mệnh'],
    ['庙旺', 'Miếu Vượng'],
    ['落陷', 'lạc hãm'],
    ['化禄', 'Hóa Lộc'],
    ['化权', 'Hóa Quyền'],
    ['化科', 'Hóa Khoa'],
    ['化忌', 'Hóa Kỵ'],
    ['左辅', 'Tả Phù'],
    ['右弼', 'Hữu Bật'],
    ['文昌', 'Văn Xương'],
    ['文曲', 'Văn Khúc'],
    ['天魁', 'Thiên Khôi'],
    ['天钺', 'Thiên Việt'],
    ['禄存', 'Lộc Tồn'],
    ['天马', 'Thiên Mã'],
    ['擎羊', 'Kình Dương'],
    ['陀罗', 'Đà La'],
    ['火星', 'Hỏa Tinh'],
    ['铃星', 'Linh Tinh'],
    ['地空', 'Địa Không'],
    ['地劫', 'Địa Kiếp'],
    ['紫微', 'Tử Vi'],
    ['天机', 'Thiên Cơ'],
    ['太阳', 'Thái Dương'],
    ['武曲', 'Vũ Khúc'],
    ['天同', 'Thiên Đồng'],
    ['廉贞', 'Liêm Trinh'],
    ['天府', 'Thiên Phủ'],
    ['太阴', 'Thái Âm'],
    ['贪狼', 'Tham Lang'],
    ['巨门', 'Cự Môn'],
    ['天相', 'Thiên Tướng'],
    ['天梁', 'Thiên Lương'],
    ['七杀', 'Thất Sát'],
    ['破军', 'Phá Quân'],
    ['命宫', 'Mệnh Cung'],
    ['身宫', 'Thân Cung'],
    ['兄弟宫', 'cung Huynh Đệ'],
    ['夫妻宫', 'cung Phu Thê'],
    ['子女宫', 'cung Tử Nữ'],
    ['财帛宫', 'cung Tài Bạch'],
    ['疾厄宫', 'cung Tật Ách'],
    ['迁移宫', 'cung Thiên Di'],
    ['交友宫', 'cung Giao Hữu'],
    ['仆役宫', 'cung Giao Hữu'],
    ['官禄宫', 'cung Quan Lộc'],
    ['田宅宫', 'cung Điền Trạch'],
    ['福德宫', 'cung Phúc Đức'],
    ['父母宫', 'cung Phụ Mẫu'],
    ['子宫', 'cung Tý'],
    ['丑宫', 'cung Sửu'],
    ['寅宫', 'cung Dần'],
    ['卯宫', 'cung Mão'],
    ['辰宫', 'cung Thìn'],
    ['巳宫', 'cung Tỵ'],
    ['午宫', 'cung Ngọ'],
    ['未宫', 'cung Mùi'],
    ['申宫', 'cung Thân'],
    ['酉宫', 'cung Dậu'],
    ['戌宫', 'cung Tuất'],
    ['亥宫', 'cung Hợi'],
    ['煞星', 'sát tinh'],
    ['吉星', 'cát tinh'],
    ['贵人', 'quý nhân'],
    ['空宫', 'Vô Chính Diệu'],
    ['、', ', '],
    ['（', ' ('],
    ['）', ')'],
    ['《', ''],
    ['》', ''],
  ];
  for (const [cn, vi] of replacements) {
    out = out.replaceAll(cn, vi);
  }
  out = out.replace(/第(\d+)条/g, ', điều $1');
  return out.replace(/\s+/g, ' ').trim();
}

export interface LocalizedPattern extends Pattern {
  hanziName?: string;
  rawNote?: string;
  rawSource?: string;
}

export function localizePattern(p: Pattern): LocalizedPattern {
  let viName = PATTERN_NAME_VI[p.name];
  if (!viName) {
    if (p.name.endsWith('化禄入命')) {
      const star = p.name.replace('化禄入命', '');
      viName = `${translateStarName(star)} Hóa Lộc Nhập Mệnh`;
    } else if (p.name.includes('化忌入')) {
      const [star, target] = p.name.split('化忌入');
      viName = `${translateStarName(star)} Hóa Kỵ Nhập ${target === '命' ? 'Mệnh' : 'Thiên Di'}`;
    } else {
      viName = translateChineseTextFragment(p.name);
    }
  }

  let viDesc = PATTERN_DESC_VI[p.name];
  if (!viDesc) {
    if (p.name.endsWith('化禄入命')) {
      const star = translateStarName(p.name.replace('化禄入命', ''));
      viDesc = `Sao ${star} Hóa Lộc tọa thủ Mệnh Cung, chủ nhân duyên tốt đẹp, tài lộc hanh thông, biết phát huy sở trường của sao ${star} để tạo dựng cơ nghiệp.`;
    } else if (p.name.includes('化忌入')) {
      const [starRaw, target] = p.name.split('化忌入');
      const star = translateStarName(starRaw);
      viDesc = target === '命'
        ? `Sao ${star} Hóa Kỵ tọa Mệnh Cung — nhắc nhở tránh cầu toàn hoặc suy nghĩ quá mức ở lĩnh vực sao ${star} chủ quản; lấy sự điềm tĩnh và kiên trì làm gốc.`
        : `Sao ${star} Hóa Kỵ tọa cung Thiên Di — khi xuất ngoại hoặc mở rộng giao tiếp xã hội cần cẩn trọng, lấy chữ tín và sự chuẩn bị kỹ lưỡng làm đầu.`;
    } else {
      viDesc = translateChineseTextFragment(p.description);
    }
  }

  // Extract classical note if description came from Quanshu strict format
  const rawNoteMatch = p.description.match(/^原书第(\d+)条[：:]\s*「(.+)」/);
  const rawNote = rawNoteMatch ? rawNoteMatch[2] : undefined;

  return {
    ...p,
    name: viName,
    hanziName: p.name,
    rawNote,
    rawSource: p.source,
    description: viDesc,
    palaces: p.palaces.map((pa) => translatePalaceName(pa)),
    conditions: p.conditions
      ? {
          required: p.conditions.required.map(translateChineseTextFragment),
          bonus: p.conditions.bonus?.map(translateChineseTextFragment),
          breaking: p.conditions.breaking?.map(translateChineseTextFragment),
        }
      : undefined,
    source: p.source ? translateChineseTextFragment(p.source) : undefined,
  };
}

// ─── 8. Danh Nhân Mệnh Bàn (Vietnamese Localized Famous Charts) ─────────────
export interface ViFamousPerson {
  id: string;
  name: string;
  category: 'Thương Nghiệp' | 'Văn Nghệ' | 'Công Nghệ' | 'Thể Thao' | 'Lịch Sử';
  description: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  gender: 'male' | 'female';
  notable: string;
}

export const VI_FAMOUS_PERSONS: ViFamousPerson[] = [
  {
    id: 'steve-jobs',
    name: 'Steve Jobs',
    category: 'Công Nghệ',
    description: 'Đồng sáng lập Apple · Biểu tượng cách mạng công nghệ',
    year: 1955, month: 2, day: 24, hour: 6, // Giờ Ngọ
    gender: 'male',
    notable: 'Cách cục Phá Quân nhập Mệnh điển hình — phá cựu lập tân, trải qua thăng trầm lớn rồi kiến tạo đế chế công nghệ thay đổi thế giới.',
  },
  {
    id: 'elon-musk',
    name: 'Elon Musk',
    category: 'Công Nghệ',
    description: 'Nhà sáng lập SpaceX & CEO Tesla',
    year: 1971, month: 6, day: 28, hour: 4, // Giờ Thìn
    gender: 'male',
    notable: 'Cách cục Sát Phá Lang hội Thiên Mã cực vượng — cả đời không ngừng mở rộng biên giới công nghệ nhân loại từ xe điện đến vũ trụ.',
  },
  {
    id: 'ma-yun',
    name: 'Jack Ma (Mã Vân)',
    category: 'Thương Nghiệp',
    description: 'Nhà sáng lập Tập đoàn Alibaba',
    year: 1964, month: 9, day: 10, hour: 5, // Giờ Tỵ
    gender: 'male',
    notable: 'Lá số thể hiện năng lực phá cách lập tân mạnh mẽ, tinh diệu cung Quan Lộc và Tài Bạch tương ứng chặt chẽ với đế chế thương mại điện tử.',
  },
  {
    id: 'li-jiacheng',
    name: 'Lý Gia Thành (Li Ka-shing)',
    category: 'Thương Nghiệp',
    description: 'Tỷ phú Hồng Kông · Nhà sáng lập CK Hutchison',
    year: 1928, month: 7, day: 29, hour: 3, // Giờ Mão
    gender: 'male',
    notable: 'Tứ Hóa tại cung Tài Bạch và Lộc Tồn thủ tài là trường hợp kinh điển nghiên cứu về khả năng tích lũy tài sản bền vững qua nhiều thập kỷ.',
  },
  {
    id: 'ren-zhengfei',
    name: 'Nhậm Chính Phi',
    category: 'Thương Nghiệp',
    description: 'Nhà sáng lập Tập đoàn Huawei',
    year: 1944, month: 10, day: 25, hour: 3, // Giờ Mão
    gender: 'male',
    notable: 'Thất Sát nhập Mệnh cách cục — càng gặp nghịch cảnh và áp lực lớn càng bứt phá mạnh mẽ, minh chứng sống động cho lý thuyết Thất Sát của Nghê Sư.',
  },
  {
    id: 'jay-chou',
    name: 'Châu Kiệt Luân (Jay Chou)',
    category: 'Văn Nghệ',
    description: 'Thiên vương âm nhạc Á Châu',
    year: 1979, month: 1, day: 18, hour: 1, // Giờ Sửu
    gender: 'male',
    notable: 'Sự kết hợp giữa Văn Khúc và Tham Lang tạo nên thiên phú âm nhạc độc đáo, kết hợp cổ phong phương Đông với âm nhạc hiện đại.',
  },
  {
    id: 'zhang-ailing',
    name: 'Trương Ái Linh (Eileen Chang)',
    category: 'Văn Nghệ',
    description: 'Nữ văn hào kiệt xuất cận đại',
    year: 1920, month: 9, day: 30, hour: 1, // Giờ Sửu
    gender: 'female',
    notable: 'Tổ hợp tinh diệu mang nét thanh cao cô tuyệt, đối ứng kỳ diệu với văn tài lỗi lạc và cuộc đời tình cảm đầy chất thơ.',
  },
  {
    id: 'lin-zhiling',
    name: 'Lâm Chí Linh',
    category: 'Văn Nghệ',
    description: 'Người mẫu, diễn viên & nhà hoạt động từ thiện',
    year: 1974, month: 11, day: 29, hour: 5, // Giờ Tỵ
    gender: 'female',
    notable: 'Thái Âm thủ Mệnh điển hình — minh chứng cho luận đoán của Nghê Sư: "Thái Âm nhập Mệnh nữ giới mang vẻ đẹp thanh nhã, dịu dàng và phúc hậu".',
  },
];

// ─── 9. Tóm tắt lá số sang văn bản tiếng Việt (cho AI Prompt & Local Analysis) ─
export function formatChartSummaryVi(chart: ZiweiChart): string {
  const shen = chart.palaces.find((p) => p.branch === chart.shenGongBranch);
  const lines: string[] = [];

  lines.push(
    `- Đương số: ${chart.birthInfo.name || 'Ẩn danh'} (${translateYinYang(
      chart.yinYangGender
    )}, sinh năm Dương lịch ${chart.birthInfo.year}-${chart.birthInfo.month}-${
      chart.birthInfo.day
    }, Giờ ${VI_BRANCHES[chart.birthInfo.hour]})`
  );
  lines.push(
    `- Âm lịch: Năm ${VI_STEMS[chart.lunarInfo.yearStem]} ${
      VI_BRANCHES[chart.lunarInfo.yearBranch]
    } (${chart.lunarInfo.lunarYear}), tháng ${
      chart.lunarInfo.isLeapMonth ? 'nhuận ' : ''
    }${chart.lunarInfo.lunarMonth}, ngày ${chart.lunarInfo.lunarDay}`
  );
  if (chart.lunarInfo.fourPillars) {
    lines.push(
      `- Tứ Trụ (Bát Tự): ${chart.lunarInfo.fourPillars.map(translateGanZhi).join(' · ')}`
    );
  }
  lines.push(
    `- Ngũ Hành Cục: ${translateWuxingJu(chart.wuxingJuName)} · Mệnh Chủ: ${translateStarName(
      chart.mingZhu
    )} · Thân Chủ: ${translateStarName(chart.shenZhu)}`
  );
  lines.push(
    `- Mệnh Cung tại ${VI_BRANCHES[chart.mingGongBranch]}, Thân Cung tại ${
      VI_BRANCHES[chart.shenGongBranch]
    } (${translatePalaceName(shen?.name)})`
  );
  lines.push(`- Tuổi âm lịch hiện tại: ${chart.currentAge} tuổi`);

  if (chart.currentDaXianIndex >= 0 && chart.daXians[chart.currentDaXianIndex]) {
    const dx = chart.daXians[chart.currentDaXianIndex];
    lines.push(
      `- Đại Hạn hiện tại: ${dx.startAge}–${dx.endAge} tuổi tại cung ${translatePalaceName(
        dx.palaceName
      )} (${VI_BRANCHES[dx.palaceBranch]})`
    );
  }

  lines.push(`\nChi tiết 12 Cung trên Lá Số:`);
  for (const p of chart.palaces) {
    const gz = `${VI_STEMS[p.stem]} ${VI_BRANCHES[p.branch]}`;
    const majors = p.stars
      .filter((s) => s.type === 'major')
      .map((s) => {
        const b = s.brightnessRaw ? `[${translateBrightness(s.brightnessRaw)}]` : '';
        const sh = s.siHua ? `(Hóa ${translateSiHua(s.siHua)})` : '';
        return `${translateStarName(s.name)}${b}${sh}`;
      });
    const luckys = p.stars
      .filter((s) => s.type === 'lucky')
      .map((s) => {
        const sh = s.siHua ? `(Hóa ${translateSiHua(s.siHua)})` : '';
        return `${translateStarName(s.name)}${sh}`;
      });
    const shas = p.stars
      .filter((s) => s.type === 'sha')
      .map((s) => translateStarName(s.name));
    const majorText =
      majors.length > 0
        ? majors.join(', ')
        : `Vô chính diệu (Mượn sao đối cung ${translatePalaceName(
            p.borrowedFromName
          )}: ${(p.borrowedStars ?? []).map((s) => translateStarName(s)).join(', ')})`;
    lines.push(
      `• ${translatePalaceName(p.name)} (${gz})${p.isMingGong ? ' [MỆNH]' : ''}${
        p.isShenGong ? ' [THÂN]' : ''
      }${
        p.daXianAge ? ` [Đại hạn ${p.daXianAge[0]}-${p.daXianAge[1]}]` : ''
      }: Chính tinh: ${majorText} | Cát tinh: ${luckys.join(', ') || 'Không'} | Sát tinh: ${
        shas.join(', ') || 'Không'
      }`
    );
  }

  return lines.join('\n');
}

// ─── 10. Bộ Luận Giải Bản Địa (Deterministic Vietnamese Fallback Engine) ─────
export function generateLocalInterpretationVi(
  chart: ZiweiChart,
  promptText: string,
  periodCtx?: import('./yunxian-context').YunxianPeriodContext | null,
): string {
  const ming = chart.palaces.find((p) => p.branch === chart.mingGongBranch)!;
  const cai = chart.palaces.find((p) => p.name.includes('财帛'))!;
  const guan = chart.palaces.find((p) => p.name.includes('官禄'))!;
  const qian = chart.palaces.find((p) => p.name.includes('迁移'))!;
  const fuqi = chart.palaces.find((p) => p.name.includes('夫妻'))!;
  const jie = chart.palaces.find((p) => p.name.includes('疾厄'))!;
  const fude = chart.palaces.find((p) => p.name.includes('福德'))!;
  const tianzhai = chart.palaces.find((p) => p.name.includes('田宅'))!;

  const getPalaceStarNames = (p?: Palace) => {
    if (!p) return { majors: [] as string[], rawMajors: [] as string[], summary: 'Vô chính diệu' };
    const m = p.stars.filter((s) => s.type === 'major');
    if (m.length > 0) {
      return {
        majors: m.map(
          (s) =>
            `${translateStarName(s.name)}${
              s.brightnessRaw ? ` (${translateBrightness(s.brightnessRaw)})` : ''
            }${s.siHua ? ` Hóa ${translateSiHua(s.siHua)}` : ''}`
        ),
        rawMajors: m.map((s) => s.name),
        summary: m
          .map(
            (s) =>
              `${translateStarName(s.name)}${
                s.siHua ? ` Hóa ${translateSiHua(s.siHua)}` : ''
              }`
          )
          .join(' · '),
      };
    }
    const borrowed = (p.borrowedStars ?? []).map((s) => translateStarName(s));
    return {
      majors: borrowed.map((s) => `${s} (mượn đối cung)`),
      rawMajors: p.borrowedStars ?? [],
      summary: borrowed.length
        ? `Vô chính diệu (mượn ${borrowed.join(', ')} từ cung ${translatePalaceName(
            p.borrowedFromName
          )})`
        : 'Vô chính diệu',
    };
  };

  const mingInfo = getPalaceStarNames(ming);
  const primaryStarCn = mingInfo.rawMajors[0] ?? '紫微';
  const primaryDetail = VI_STAR_DETAILS[primaryStarCn] ?? VI_STAR_DETAILS['紫微'];
  const currentDx =
    chart.currentDaXianIndex >= 0 ? chart.daXians[chart.currentDaXianIndex] : null;

  const periodBlock = periodCtx
    ? (() => {
        const lu = periodCtx.periodSiHua.find((x) => x.mutagenKey === '禄');
        const quan = periodCtx.periodSiHua.find((x) => x.mutagenKey === '权');
        const ke = periodCtx.periodSiHua.find((x) => x.mutagenKey === '科');
        const ji = periodCtx.periodSiHua.find((x) => x.mutagenKey === '忌');
        return `\n\n**[Biến Chuyển Trong Kỳ Hạn Đang Chọn: ${periodCtx.periodTitleVi}]**
• **Cung bản mệnh kích hoạt**: **${periodCtx.activatedPalace.natalPalaceNameVi} (${periodCtx.activatedPalace.ganZhiVi})** — Chính tinh: **${periodCtx.activatedPalace.majorStarsSummaryVi}**
• **Tứ Hóa kỳ hạn (Can ${VI_STEMS[periodCtx.stemIndex]})**: **${lu?.starNameVi} Hóa Lộc** tại ${lu?.natalPalaceNameVi} · **${quan?.starNameVi} Hóa Quyền** tại ${quan?.natalPalaceNameVi} · **${ke?.starNameVi} Hóa Khoa** tại ${ke?.natalPalaceNameVi} · **${ji?.starNameVi} Hóa Kỵ** tại ${ji?.natalPalaceNameVi} (xung chiếu ${ji?.oppositePalaceNameVi}).`;
      })()
    : '';

  if (
    promptText.includes('tình duyên') ||
    promptText.includes('Phu Thê') ||
    promptText.includes('夫妻') ||
    promptText.includes('感情')
  ) {
    const fqInfo = getPalaceStarNames(fuqi);
    const fdInfo = getPalaceStarNames(fude);
    const fqStarDetail = VI_STAR_DETAILS[fqInfo.rawMajors[0] ?? ''] ?? primaryDetail;
    return `**[Định Tính Cung Phu Thê & Duyên Phận]**
Cung Phu Thê của đương số tọa tại **${VI_STEMS[fuqi.stem]} ${VI_BRANCHES[fuqi.branch]}**, tinh hệ chủ đạo là **${fqInfo.summary}**. Kết hợp với cung Phúc Đức (**${fdInfo.summary}**) theo nguyên tắc "Song cung liên tham" của danh sư Nghê Hải Hạ, đường tình duyên mang sắc thái trọng tình nghĩa và cần sự thấu hiểu chiều sâu.

**[Luận Giải Chính Tinh Cung Phu Thê]**
${fqStarDetail.relationship}. Theo hệ thống Thiên Kỷ: ${fqStarDetail.niHaixia}

**[Tam Phương Tứ Chính & Phúc Đức Liên Động]**
• **Cung Phúc Đức (${VI_BRANCHES[fude.branch]})**: ${fdInfo.summary}
• **Cung Quan Lộc (${VI_BRANCHES[guan.branch]})**: ${getPalaceStarNames(guan).summary}
• **Cung Thiên Di (${VI_BRANCHES[qian.branch]})**: ${getPalaceStarNames(qian).summary}
Nhịp độ công việc và đời sống tinh thần ảnh hưởng trực tiếp đến sự gắn kết và hòa khí gia đình.

**[Vận Hạn Tình Cảm Hiện Tại]**
${currentDx ? `Hiện tại đương số đang ở Đại Hạn **${currentDx.startAge}–${currentDx.endAge} tuổi** tại cung **${translatePalaceName(currentDx.palaceName)}** (${VI_BRANCHES[currentDx.palaceBranch]}).` : 'Đương số đang trong giai đoạn tích lũy nền tảng.'} Khi lưu niên đi qua các cung có Hồng Loan, Thiên Hỷ hoặc Tam Hợp Phu Thê sẽ có tín hiệu khởi sắc rõ rệt.${periodBlock}

**[Lời Khuyên Thực Tiễn]**
Lấy sự lắng nghe và tôn trọng không gian riêng làm gốc; khi trao đổi việc lớn trong gia đình nên chọn lúc tâm thế cả hai cùng thư thái.`;
  }

  if (
    promptText.includes('sự nghiệp') ||
    promptText.includes('Quan Lộc') ||
    promptText.includes('官禄') ||
    promptText.includes('事业')
  ) {
    const guanInfo = getPalaceStarNames(guan);
    const caiInfo = getPalaceStarNames(cai);
    const guanDetail = VI_STAR_DETAILS[guanInfo.rawMajors[0] ?? ''] ?? primaryDetail;
    return `**[Định Tính Cách Cục Sự Nghiệp]**
Cung Quan Lộc tọa tại **${VI_STEMS[guan.stem]} ${VI_BRANCHES[guan.branch]}** với tinh hệ **${guanInfo.summary}**, phối hợp cùng Mệnh Cung (**${mingInfo.summary}**) tạo nên định hướng phát triển rõ nét.

**[Luận Giải Cung Quan Lộc Theo Nghê Sư]**
Ngành nghề và định hướng phù hợp: **${guanDetail.career}**. ${guanDetail.niHaixia}

**[Liên Động Tài Bạch & Thiên Di]**
• **Cung Tài Bạch (${VI_BRANCHES[cai.branch]})**: ${caiInfo.summary}
• **Cung Thiên Di (${VI_BRANCHES[qian.branch]})**: ${getPalaceStarNames(qian).summary}
Sự nghiệp phát triển mạnh khi kết hợp năng lực chuyên môn sâu với việc mở rộng uy tín cá nhân ngoài xã hội.

**[Đại Hạn Sự Nghiệp Hiện Tại]**
${currentDx ? `Trong Đại Hạn **${currentDx.startAge}–${currentDx.endAge} tuổi** (cung **${translatePalaceName(currentDx.palaceName)}**), trọng tâm là củng cố vị thế chuyên môn và tận dụng mạng lưới quý nhân.` : 'Giai đoạn hiện tại thích hợp trau dồi tri thức và kỹ năng cốt lõi.'}${periodBlock}

**[Chiến Lược Hành Động]**
Tập trung sâu vào lĩnh vực sở trường của bộ sao **${guanInfo.summary}**, kiên trì tích lũy uy tín (Hóa Khoa/Quý nhân) trước khi mở rộng quy mô.`;
  }

  if (
    promptText.includes('tài lộc') ||
    promptText.includes('Tài Bạch') ||
    promptText.includes('财帛') ||
    promptText.includes('财运')
  ) {
    const caiInfo = getPalaceStarNames(cai);
    const tzInfo = getPalaceStarNames(tianzhai);
    const caiDetail = VI_STAR_DETAILS[caiInfo.rawMajors[0] ?? ''] ?? primaryDetail;
    return `**[Định Tính Cách Cục Tài Lộc]**
Cung Tài Bạch tọa tại **${VI_STEMS[cai.stem]} ${VI_BRANCHES[cai.branch]}** với tinh hệ **${caiInfo.summary}**. ${caiDetail.wealth}

**[Phân Tích Nguồn Thu (Tài Bạch)]**
Với bộ sao **${caiInfo.summary}** thủ Tài Bạch, phương thức tạo dựng dòng tiền thuận lợi nhất gắn liền với: **${caiDetail.career}**.

**[Cung Điền Trạch (Kho Tài Sản)]**
• **Cung Điền Trạch (${VI_BRANCHES[tianzhai.stem ? tianzhai.branch : 0]})**: ${tzInfo.summary}
• **Cung Phúc Đức (${VI_BRANCHES[fude.branch]})**: ${getPalaceStarNames(fude).summary}
Phản ánh khả năng chuyển hóa thu nhập thành tài sản tích lũy và bất động sản bền vững.

**[Vận Trình Tài Chính Hiện Tại]**
${currentDx ? `Đại hạn **${currentDx.startAge}–${currentDx.endAge} tuổi** đi qua cung **${translatePalaceName(currentDx.palaceName)}** nhắc nhở quản trị dòng tiền kỷ luật, ưu tiên đầu tư giá trị thực.` : 'Nên ưu tiên tích lũy nền tảng tài chính an toàn.'}${periodBlock}

**[Lời Khuyên Quản Lý Tài Chính]**
Phân bổ dòng tiền giữa phát triển sự nghiệp và tích lũy điền sản; hạn chế đầu cơ ngắn hạn khi lưu niên gặp sát tinh xâm phạm Tài - Phúc.`;
  }

  if (
    promptText.includes('sức khỏe') ||
    promptText.includes('Tật Ách') ||
    promptText.includes('疾厄') ||
    promptText.includes('健康')
  ) {
    const jieInfo = getPalaceStarNames(jie);
    const jieDetail = VI_STAR_DETAILS[jieInfo.rawMajors[0] ?? ''] ?? primaryDetail;
    return `**[Phân Tích Tinh Hệ Cung Tật Ách]**
Cung Tật Ách tọa tại **${VI_STEMS[jie.stem]} ${VI_BRANCHES[jie.branch]}** với bộ sao **${jieInfo.summary}**.

**[Cơ Địa & Tạng Phủ Cần Lưu Ý (Đông Y Nghê Sư)]**
• **Trọng tâm Cung Tật Ách**: ${jieDetail.health}
• **Liên đới Bản Mệnh**: ${primaryDetail.health}

**[Xu Hướng Sức Khỏe Trong Đại Hạn]**
${currentDx ? `Ở độ tuổi **${chart.currentAge}** (Đại hạn **${currentDx.startAge}–${currentDx.endAge} tuổi**), cần chú ý cân bằng giữa cường độ làm việc và giấc ngủ theo quy luật Tý Ngọ Lưu Chú.` : 'Cần duy trì thói quen vận động điều độ.'}${periodBlock}

**[Phương Pháp Dưỡng Sinh Chủ Động]**
Ngủ trước giờ Tý (23:00) để dưỡng Đởm và Can huyết, giữ tâm thái an hòa và duy trì vận động nhẹ nhàng mỗi ngày.`;
  }

  if (
    promptText.includes('tính cách') ||
    promptText.includes('Phúc Đức') ||
    promptText.includes('Thiên Hướng') ||
    promptText.includes('福德')
  ) {
    const fdInfo = getPalaceStarNames(fude);
    const fdDetail = VI_STAR_DETAILS[fdInfo.rawMajors[0] ?? ''] ?? primaryDetail;
    return `**[Khí Chất Cốt Lõi & Bản Tính Tiên Thiên]**
Mệnh Cung tọa tại **${VI_STEMS[ming.stem]} ${VI_BRANCHES[ming.branch]}** với chính tinh **${mingInfo.summary}** (${primaryDetail.nature}, hành **${primaryDetail.element}**). Đặc trưng nổi bật: **${primaryDetail.keywords.join(' · ')}**. ${primaryDetail.brief}

**[Chiều Sâu Nội Tâm & Cung Phúc Đức]**
Cung Phúc Đức tọa tại **${VI_STEMS[fude.stem]} ${VI_BRANCHES[fude.branch]}** có tinh hệ **${fdInfo.summary}**. ${fdDetail.niHaixia}

**[Thiên Hướng Phát Triển & Nhân Sinh Quan]**
• **Sở trường bẩm sinh**: ${primaryDetail.career}
• **Phong cách ứng xử xã hội (Thiên Di)**: ${getPalaceStarNames(qian).summary}
• **Điểm tựa tinh thần (Phúc Đức)**: ${fdInfo.summary}${periodBlock}

**[Lời Khuyên Tu Dưỡng Tâm Tính]**
Phát huy ưu điểm **${primaryDetail.keywords.join(', ')}** của chính tinh Mệnh Cung, đồng thời giữ tâm thế điềm tĩnh và bao dung trước những biến động ngoại cảnh.`;
  }

  // Default: Overview / Palace specific
  return `**[Định Tính Mệnh Cách]**
Đương số mệnh **${translateYinYang(chart.yinYangGender)}**, Cục số **${translateWuxingJu(chart.wuxingJuName)}**, Mệnh Cung an tại **${VI_STEMS[ming.stem]} ${VI_BRANCHES[ming.branch]}** với tinh hệ chủ đạo **${mingInfo.summary}**, Mệnh Chủ là **${translateStarName(chart.mingZhu)}**, Thân Chủ là **${translateStarName(chart.shenZhu)}**. ${primaryDetail.brief}

**[Luận Giải Chính Tinh Theo Hệ Thống Nghê Hải Hạ]**
${primaryDetail.niHaixia}

**[Tam Phương Tứ Chính Liên Động]**
• **Mệnh Cung (${VI_BRANCHES[ming.branch]})**: ${mingInfo.summary}
• **Cung Tài Bạch (${VI_BRANCHES[cai.branch]})**: ${getPalaceStarNames(cai).summary}
• **Cung Quan Lộc (${VI_BRANCHES[guan.branch]})**: ${getPalaceStarNames(guan).summary}
• **Cung Thiên Di (${VI_BRANCHES[qian.branch]})**: ${getPalaceStarNames(qian).summary}
Bốn cung hợp thành khung sườn vận mệnh: Mệnh vi bản, Tam phương vi dụng — kết hợp giữa nội lực của **${mingInfo.summary}** và môi trường bên ngoài tại Thiên Di (**${getPalaceStarNames(qian).summary}**).

**[Đại Hạn Hiện Tại (${chart.currentAge} tuổi)]**
${currentDx ? `Đương số đang hành vận tại Đại Hạn **${currentDx.startAge}–${currentDx.endAge} tuổi**, đóng ở cung **${translatePalaceName(currentDx.palaceName)} (${VI_BRANCHES[currentDx.palaceBranch]})**. Đây là giai đoạn 10 năm trọng điểm để phát huy năng lực sự nghiệp (${primaryDetail.career}) và củng cố nền tảng tài chính.` : `Đương số hiện ${chart.currentAge} tuổi, đang trong giai đoạn bồi đắp nền tảng tri thức và nhân duyên.`}${periodBlock}

**[Thế Mạnh Thiên Phú & Điểm Cần Lưu Tâm]**
• **Thế mạnh**: ${primaryDetail.keywords.join(' · ')} — thích hợp phát triển tại ${primaryDetail.career}.
• **Lưu tâm**: ${primaryDetail.relationship}; về sức khỏe chú ý: ${primaryDetail.health}.`;
}
