/**
 * Kho tri thức Hợp Bàn Tử Vi Đẩu Số
 * Dựa trên hệ thống Thiên Kỷ của Nghê Hải Hạ và Tử Vi Đẩu Số Toàn Thư
 */

// ─── 14 Chính Tinh tại cung Phu Thê ──────────────────────────

export const STAR_IN_FUQI_GU: Record<string, {
  summary: string;
  good: string;
  bad: string;
  spouse_traits: string;
  timing: string;
  ni_quote?: string;
}> = {
  '紫微': {
    summary: 'Bạn đời tự trọng cao và có năng lực, hợp kết hôn muộn, tình cảm lấy sự tôn trọng làm gốc',
    good: 'Tam phương có Tả Phù, Hữu Bật hội chiếu thì bạn đời hiền tài, sau kết hôn được quý nhân trợ lực; tam hợp gặp Lộc chủ tài lộc song toàn',
    bad: 'Cô quân vô phụ thì bạn đời dễ cứng rắn khó dung hòa; tại Thìn Tuất cần vun đắp sự thấu hiểu; hội Phá Quân thì trước hôn nhân dễ có thử thách',
    spouse_traits: 'Phong thái đĩnh đạc, có chính kiến riêng, tự trọng cao, năng lực vững nhưng ít bộc lộ cảm xúc ra ngoài',
    timing: 'Nên kết hôn muộn (nam từ 30 tuổi, nữ từ 27 tuổi trở lên) để tâm tính đôi bên chín chắn',
    ni_quote: 'Tử Vi tại cung Phu Thê chủ khí chất độc lập, kết hôn muộn và biết nhường nhịn nhau thì gia đạo bền vững',
  },
  '天机': {
    summary: 'Nhịp điệu tình cảm linh hoạt, hợp với bạn đời có khoảng cách tuổi tác nhất định',
    good: 'Gặp Lộc Tồn hoặc Hóa Lộc thì tình cảm gắn kết hài hòa; hội Thái Âm tăng thêm sự tinh tế và dịu dàng',
    bad: 'Gặp Hóa Kỵ hoặc sát tinh thì tâm lý dễ dao động, suy nghĩ nhiều; cần tránh do dự hoặc nhạy cảm quá mức',
    spouse_traits: 'Thông minh, lanh lợi, tư duy sâu sắc, có duyên với học thuật và triết lý sống',
    timing: 'Hợp bạn đời chênh lệch từ 4–6 tuổi trở lên để bù trừ sự ổn định cảm xúc',
    ni_quote: 'Thiên Cơ chủ sự linh hoạt biến thông, trong hôn nhân cần lấy sự chân thành và ổn định làm điểm tựa',
  },
  '太阳': {
    summary: 'Nam mệnh được vợ hiền trợ lực, nữ mệnh vượng phu; nếu lạc hãm gặp Kỵ cần chú trọng sẻ chia',
    good: 'Miếu Vượng (từ Mão đến Thân): bạn đời tháo vát, nam mệnh có hiền nội trợ, nữ mệnh gặp chồng chí thú làm ăn',
    bad: 'Lạc hãm (từ Dậu đến Dần) hoặc gặp Hóa Kỵ: cần quan tâm chăm sóc sức khỏe của người phối ngẫu và tránh áp đặt kỳ vọng quá lớn',
    spouse_traits: 'Quang minh, hào sảng, trọng danh dự và trách nhiệm xã hội, đôi khi hơi nóng tính',
    timing: 'Tình cảm ban đầu nồng nhiệt, về lâu dài cần giữ sự lãng mạn và tôn trọng không gian riêng',
    ni_quote: 'Thái Dương đắc địa tại Phu Thê là ánh mặt trời sưởi ấm gia đạo; nếu gặp Hóa Kỵ thì cần đặc biệt chăm lo sức khỏe cho người bạn đời',
  },
  '武曲': {
    summary: 'Tính cách cương nghị và thực tế, hôn nhân nên muộn và cần sự mềm mỏng',
    good: 'Vũ Khúc Hóa Lộc hoặc hội Lộc Tồn: bạn đời giỏi quản lý tài chính, kinh tế gia đình vững vàng',
    bad: 'Gặp Hóa Kỵ hoặc đồng cung Thất Sát, Phá Quân hội sát tinh: đôi bên dễ thẳng thắn quá mức gây căng thẳng, cần nhẫn nhịn',
    spouse_traits: 'Cương trực, độc lập, nói năng dứt khoát, giỏi kiếm tiền nhưng ít nói lời hoa mỹ',
    timing: 'Hệ sao Vũ Khúc tại Phu Thê rất hợp kết hôn sau tuổi 30 khi sự nghiệp đã định hình',
    ni_quote: 'Vũ Khúc chủ sự cương quyết, trong đời sống vợ chồng cần lấy nhu thắng cương và kết hôn muộn để hòa hợp lâu dài',
  },
  '天同': {
    summary: 'Bạn đời ôn hòa, giàu lòng bao dung, hợp kết hôn muộn hoặc có khoảng cách tuổi tác',
    good: 'Gặp Lộc Tồn hoặc Hóa Lộc: bạn đời hiền hòa mang lại phúc khí, gia đình ấm êm; đồng cung Thái Âm thì tình cảm ngọt ngào',
    bad: 'Gặp Hóa Kỵ hoặc nhiều sát tinh: dễ nảy sinh hiểu lầm do thiếu chủ động giải bày tâm sự',
    spouse_traits: 'Hiền lành, lạc quan, trọng đời sống tinh thần và sự bình yên trong gia đình',
    timing: 'Hợp kết hôn khi tâm lý đã trưởng thành hoặc đôi bên có sự bù trừ về kinh nghiệm sống',
  },
  '廉贞': {
    summary: 'Ngôi sao giàu cảm xúc và cá tính mạnh, cần sự thấu cảm và tôn trọng cao trong hôn nhân',
    good: 'Liêm Trinh Thiên Phủ (Tý, Ngọ) hoặc hội cát tinh: bạn đời thanh lịch, có năng lực chuyên môn và gắn bó ổn định',
    bad: 'Đồng cung Tham Lang, Phá Quân hoặc Thất Sát lại gặp Hóa Kỵ, Hỏa Tinh: dễ có giai đoạn xa cách do công việc hoặc xung đột cá tính mạnh',
    spouse_traits: 'Ngoại hình thu hút, giỏi giao tiếp, cảm xúc phong phú nhưng có cá tính độc lập rất rõ',
    timing: 'Nên trải qua thời gian tìm hiểu kỹ lưỡng và kết hôn muộn để giảm bớt va chạm',
    ni_quote: 'Liêm Trinh tại Phu Thê khi gặp Sát Phá Tham cần lấy sự tu dưỡng, bao dung và giữ khoảng cách công việc hợp lý để hóa giải xung lực',
  },
  '天府': {
    summary: 'Thiện tinh chủ sự ổn định, bao dung, đời sống hôn nhân điềm đạm và bền vững',
    good: 'Gặp Lộc Tồn hoặc Hóa Lộc: tài lộc và tình cảm đều sung túc; tam phương không phạm sát tinh thì gia đạo hòa thuận',
    bad: 'Hội Tứ Sát hoặc Không Kiếp: đôi bên dễ bận rộn việc riêng mà thiếu sự lãng mạn, cần chủ động hâm nóng tình cảm',
    spouse_traits: 'Điềm đạm, chín chắn, biết vun vén tài chính và chăm lo cho tổ ấm',
    timing: 'Tình cảm ổn định lâu dài, cần chủ động tạo thêm niềm vui chung trong đời sống thường nhật',
  },
  '太阴': {
    summary: 'Bạn đời thanh nhã, dịu dàng và tinh tế; nếu lạc hãm gặp sát tinh cần tránh nhạy cảm đa nghi',
    good: 'Miếu Vượng (từ Dậu đến Sửu) hội cát tinh: bạn đời hiền thục, tinh tế, có thành tựu và biết chăm sóc gia đình',
    bad: 'Lạc hãm hoặc gặp Hóa Kỵ, Hỏa Linh: dễ nhạy cảm hoặc phát sinh bất đồng giữa các thế hệ trong gia đình',
    spouse_traits: 'Dịu dàng, giàu tình cảm, yêu nghệ thuật và coi trọng tổ ấm',
    timing: 'Khi Thái Âm lạc hãm nên kết hôn muộn và ưu tiên sống độc lập để giữ hòa khí gia đình',
    ni_quote: 'Thái Âm đắc địa chủ người bạn đời hiền hòa; nếu gặp Hóa Kỵ thì người chồng cần khéo léo dung hòa mối quan hệ trong gia đình',
  },
  '贪狼': {
    summary: 'Ngôi sao của sự đa tài và sức hút nhân duyên, hôn nhân cần sự tin tưởng và đồng điệu sở thích',
    good: 'Hóa Lộc hoặc Hóa Khoa: bạn đời tài hoa, duyên dáng, đời sống hôn nhân phong phú; tại Ngọ là cách văn võ song toàn',
    bad: 'Gặp Hóa Kỵ hoặc hội Tứ Sát, Đào Hoa: cần giữ ranh giới rõ ràng trong các mối quan hệ xã giao để bảo vệ hạnh phúc gia đình',
    spouse_traits: 'Tài nghệ xuất chúng, giỏi giao tiếp, năng động và có sức hấp dẫn lớn',
    timing: 'Nên kết hôn muộn sau khi cả hai đã định hình mục tiêu chung cho gia đình',
    ni_quote: 'Tham Lang chủ sự đa tài và giao thiệp rộng; nếu tọa tại cung Ngọ lại mang khí chất quyết đoán, làm việc lớn',
  },
  '巨门': {
    summary: 'Trọng sự giao tiếp và thấu hiểu sâu sắc, rất cần ánh sáng của Thái Dương để hóa giải bất đồng lời nói',
    good: 'Hội Thái Dương Miếu Vượng hoặc Hóa Lộc, Hóa Quyền: bạn đời sắc sảo, có tài ăn nói và hỗ trợ đắc lực cho sự nghiệp',
    bad: 'Gặp Hóa Kỵ hoặc Đà La đồng độ: dễ tranh luận đúng sai trong chuyện nhỏ, cần học cách lắng nghe và kiệm lời khi nóng giận',
    spouse_traits: 'Tư duy phản biện tốt, thẳng thắn, nội tâm sâu sắc và rất trọng tình nghĩa',
    timing: 'Cần xây dựng thói quen đối thoại chân thành, tránh giữ sự hiểu lầm trong lòng',
  },
  '天相': {
    summary: 'Nhân duyên gắn kết bền chặt, vợ chồng đồng lòng hợp tác và nâng đỡ lẫn nhau',
    good: 'Hội Tả Phù, Hữu Bật hoặc Lộc Mã: tình cảm thủy chung, bạn đời chính trực, đáng tin cậy',
    bad: 'Gặp nhiều sát tinh: đôi khi vì giữ thể diện mà ngại nói thẳng tâm tư, cần chia sẻ cởi mở hơn',
    spouse_traits: 'Chính trực, điềm đạm, trọng chữ tín, giỏi điều hòa các mối quan hệ và là người bạn đời lý tưởng',
    timing: 'Dễ nên duyên từ môi trường học tập, đồng nghiệp hoặc người quen giới thiệu; hợp cùng nhau làm việc',
  },
  '天梁': {
    summary: 'Bạn đời chín chắn, giàu tinh thần trách nhiệm và biết che chở cho gia đình',
    good: 'Hội Lộc hoặc cát tinh tam hợp: bạn đời phúc hậu, cư xử điềm tĩnh và có-trách-nhiệm cao',
    bad: 'Gặp Hóa Kỵ hoặc Thiên Mã, sát tinh: đôi khi hơi nguyên tắc hoặc hay khuyên nhủ nhiều lời',
    spouse_traits: 'Chín chắn, nhân hậu, trọng đạo lý, có phong thái của người trưởng bối che chở',
    timing: 'Trước hôn nhân có thể trải qua vài thử thách, nhưng sau khi kết hôn thì tình nghĩa càng lâu càng bền',
  },
  '七杀': {
    summary: 'Bạn đời có bản lĩnh độc lập mạnh mẽ, hợp kết hôn muộn và tôn trọng không gian sự nghiệp của nhau',
    good: 'Miếu Vượng (Dần, Thân) hoặc hội Lộc: bạn đời quyết đoán, hết lòng gánh vác trách nhiệm khi đã gắn bó',
    bad: 'Gặp sát tinh hoặc đồng cung Vũ Khúc tại Mão, Dậu: tính cách đôi bên đều mạnh, cần tránh áp đặt ý chí lên nhau',
    spouse_traits: 'Can trường, quyết đoán, hành động nhanh gọn, trọng chữ tín và hiệu quả thực tế',
    timing: 'Nên kết hôn sau tuổi 30 và duy trì sự tôn trọng độc lập trong công việc của mỗi người',
    ni_quote: 'Thất Sát tại Phu Thê chủ người bạn đời có cá tính mạnh, đôi bên cần lấy sự dịu dàng và bao dung để giữ ấm tổ ấm',
  },
  '破军': {
    summary: 'Ngôi sao của sự đột phá và đổi mới, trong hôn nhân cần cùng nhau đồng hành qua các bước ngoặt cuộc sống',
    good: 'Hóa Lộc hoặc Hóa Quyền ở thế Miếu Vượng: bạn đời dám nghĩ dám làm, trải qua thử thách càng gắn bó sâu sắc',
    bad: 'Gặp Hóa Kỵ hoặc hội sát tinh: dễ có biến động về nơi ở hoặc công việc làm ảnh hưởng tới nhịp sinh hoạt gia đình',
    spouse_traits: 'Yêu tự do, giàu sức sáng tạo, dám bứt phá nhưng không thích sự gò bó khuôn mẫu',
    timing: 'Nên tìm hiểu kỹ lưỡng qua thực tế công việc và cuộc sống trước khi tiến tới hôn nhân',
    ni_quote: 'Phá Quân chủ sự khai sáng đổi mới; vợ chồng cùng chung chí hướng lập nghiệp sẽ chuyển hóa năng lượng biến động thành sức mạnh đột phá',
  },
};

// ─── Tứ Hóa tại cung Phu Thê ─────────────────────────────────

export const SIHUA_IN_FUQI_GU: Record<string, string> = {
  '化禄': 'Có nhân duyên tiền định tốt đẹp với bạn đời; người phối ngẫu lạc quan, sau khi kết hôn tình cảm ấm áp và cùng nhau phát triển tài chính thuận lợi.',
  '化权': 'Bạn đời là người có năng lực tổ chức và chủ động quyết đoán trong gia đình; đôi bên nên phân công rõ trách nhiệm và tôn trọng ý kiến của nhau.',
  '化科': 'Nhân duyên thanh nhã, vợ chồng tôn trọng và thấu hiểu nhau; người phối ngẫu có học thức, uy tín chuyên môn và là quý nhân trong đời sống.',
  '化忌': 'Nhắc nhở có duyên nợ sâu nặng cần trả bằng sự kiên nhẫn; nên kết hôn muộn, tránh cầu toàn quá mức và học cách buông bỏ những chấp niệm nhỏ nhặt.',
};

// ─── Phương pháp luận Hợp Bàn cốt lõi ─────────────────────────

export const HEMING_METHODOLOGY = `
## Khung Phân Tích Hợp Bàn Tử Vi Đẩu Số (Hệ Thống Thiên Kỷ & Toàn Thư)

### 1. Nguyên tắc Song Cung Liên Tham (Cung Phu Thê & Cung Phúc Đức)
- **Cung Phu Thê**: Phản ánh khí chất, tính cách và phương thức tương tác trực tiếp với người bạn đời.
- **Cung Phúc Đức**: Phản ánh nền tảng tinh thần, nhân sinh quan và độ bền vững sâu xa của đời sống hôn nhân.
- Khi hợp bàn cần đồng thời đối chiếu cả 3 cung của đôi bên: **Mệnh Cung + Cung Phu Thê + Cung Phúc Đức**.

### 2. Tiêu chuẩn tương hợp Chính Tinh
- **Thiên Tác Chi Hợp**: Chính tinh cung Phu Thê của người A trùng với chính tinh Mệnh Cung của người B và ngược lại.
- **Tương Bổ Ngũ Hành**: Ngũ hành cục và tính chất sao Mệnh Cung của hai người tương sinh hoặc bù trừ động – tĩnh (như nhóm Sát Phá Lang kết hợp hài hòa với nhóm Tử Phủ Vũ Tướng hoặc Cơ Nguyệt Đồng Lương).

### 3. Đối chiếu Thái Dương & Thái Âm
- Trạng thái Miếu – Vượng hay Lạc Hãm của Thái Dương và Thái Âm trên cả hai lá số cho biết sự cân bằng Âm Dương và khả năng nâng đỡ tinh thần giữa vợ và chồng.

### 4. Tứ Hóa Phi Tinh & Đồng Bộ Đại Hạn
- Xét Tứ Hóa theo Thiên Can năm sinh của mỗi người bay vào cung Mệnh, Phu Thê, Phúc Đức, Tài Bạch của đối phương để nhận diện duyên trợ lực (Hóa Lộc, Hóa Khoa, Hóa Quyền) và điểm cần bao dung (Hóa Kỵ).
- Kết hợp vận trình Đại Hạn 10 năm để chọn giai đoạn thuận lợi nhất cho việc xây dựng tổ ấm và hợp tác phát triển.
`;

// ─── Bảng Phụ Tinh Hôn Nhân ───────────────────────────────────

export const MARRIAGE_STARS_BRIEF: Record<string, string> = {
  '红鸾': 'Chính tinh của hỷ sự hôn nhân; nhập Mệnh, Thân hoặc Phu Thê chủ nhân duyên chính thức nở rộ',
  '天喜': 'Ngôi sao tin vui và cát khánh, tương hội cùng Hồng Loan báo hiệu hỷ sự gia đình',
  '天姚': 'Ngôi sao của sự duyên dáng, tài hoa nghệ thuật và sức hút lãng mạn',
  '咸池': 'Đào hoa tinh mang lại sức hút cảm xúc mạnh mẽ, cần giữ sự tỉnh táo trong tình cảm',
  '孤辰': 'Ngôi sao của tính độc lập nội tâm; tọa Phu Thê nhắc nhở cần chủ động chia sẻ cảm xúc nhiều hơn',
  '寡宿': 'Chủ sự trầm tĩnh, khép kín; cần tránh giữ tâm sự một mình trong đời sống vợ chồng',
  '天哭': 'Chủ sự nhạy cảm, dễ xúc động; cần giữ tinh thần lạc quan khi đối diện thử thách',
  '天虚': 'Nhắc nhở sống thực tế, tránh kỳ vọng viển vông trong chuyện tình cảm',
  '天巫': 'Ngôi sao của phúc ấm và triết lý tâm linh; tọa Phu Thê hợp kết hôn muộn và gắn kết tinh thần',
};

export const HEMING_SCORE_CRITERIA: Record<string, string> = {
  '五星': 'Cung Phu Thê hai bên tương ứng Thiên Tác Chi Hợp, Tứ Hóa tương trợ đắc lực, Đại Hạn đồng vượng và cung Phúc Đức song cát',
  '四星': 'Cung Phu Thê một bên tương ứng Mệnh Cung đối phương, Tứ Hóa lấy Lộc Khoa làm chủ đạo, nền tảng tình cảm vững chắc',
  '三星': 'Mệnh cách tương xứng và có sự bù trừ cá tính, càng gắn bó lâu dài càng thấu hiểu và ổn định',
  '二星': 'Cung Phu Thê có sát tinh hoặc Hóa Kỵ giao hội, cần cả hai chủ động nhường nhịn và lắng nghe để giữ gìn hạnh phúc',
  '一星': 'Nhiều xung lực cá tính tại cung Phu Thê và Phúc Đức, đòi hỏi sự tu dưỡng và kiên nhẫn rất lớn từ cả hai phía',
};
