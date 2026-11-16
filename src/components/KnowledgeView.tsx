import React, { useState } from 'react';
import { VI_STAR_DETAILS, translateStarName } from '../lib/ziwei/vi-i18n';
import { BookOpen, Compass, Sparkles, Layers, Languages } from 'lucide-react';

const MAJOR_STAR_KEYS = [
  '紫微', '天机', '太阳', '武曲', '天同', '廉贞',
  '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军',
];

const NIHAI_CORE_PRINCIPLES = [
  {
    title: '1. Tam Phương Tứ Chính — Cốt Tủy Của Mệnh Cục',
    summary: 'Không bao giờ xem đơn lẻ một cung. Mệnh Cung là gốc, Tài Bạch và Quan Lộc là hai cánh tam hợp, Thiên Di là đối cung xung chiếu.',
    detail:
      'Trong Hệ Thống Thiên Kỷ, Đại sư Nghê Hải Hạ nhấn mạnh: Một sao tốt ở Mệnh nếu không có Cát tinh hội hợp từ Tam Phương Tứ Chính thì như vua không có quần thần phò tá. Ngược lại, Mệnh Vô Chính Diệu nhưng Đối Cung và Tam Hợp rực rỡ (Miếu/Vượng, Hóa Lộc, Hóa Quyền, Hóa Khoa) thì vẫn làm nên đại nghiệp khi bước vào Đại Hạn đắc địa.',
  },
  {
    title: '2. Tứ Hóa Phi Tinh — Động Lực Của Thời Gian',
    summary: 'Hóa Lộc là cơ duyên khởi đầu, Hóa Quyền là năng lực nắm giữ, Hóa Khoa là danh tiếng & quý nhân, Hóa Kỵ là nơi tâm trí chấp trước và thử thách.',
    detail:
      'Tứ Hóa (Lộc · Quyền · Khoa · Kỵ) biến chuyển theo Thiên Can của Bản Mệnh, Đại Hạn 10 năm và Lưu Niên từng năm. Hóa Kỵ không hoàn toàn xấu: Kỵ nhập cung nào là tâm huyết dồn vào cung đó; nếu biết thuận theo quy luật tự nhiên, lấy tĩnh chế động thì Hóa Kỵ chính là bài học trưởng thành sâu sắc nhất.',
  },
  {
    title: '3. Mệnh Tốt Không Bằng Vận Tốt (Mệnh Hảo Bất Như Hạn Hảo)',
    summary: 'Bản Mệnh là chiếc xe, Đại Hạn 10 năm là con đường. Xe tốt đi đường gập ghềnh vẫn xóc; xe bình thường đi trên đại lộ bằng phẳng vẫn tới đích nhanh.',
    detail:
      'Khi khảo sát lá số, cần đặc biệt chú ý các giai đoạn Đại Hạn từ 25–55 tuổi. Khi Đại Hạn đi vào cung có Chính Tinh Miếu Vượng hoặc gặp Lưu Lộc, Lưu Quyền, Lưu Khoa hội chiếu, đó là thời điểm thiên thời địa lợi để dốc toàn lực khai mở sự nghiệp.',
  },
  {
    title: '4. Y Dịch Đồng Nguyên — Tử Vi Kết Hợp Đông Y & Phong Thủy',
    summary: 'Tri mệnh để sửa mình, dưỡng sinh phòng bệnh từ Cung Tật Ách và điều chỉnh không gian sống để cải vận.',
    detail:
      'Điểm độc đáo nhất của học phái Nghê Hải Hạ là kết hợp Tử Vi Đẩu Số với Hoàng Đế Nội Kinh và Dương Trạch Tam Yếu. Nhìn vào Ngũ Hành của sao tại cung Tật Ách (VD: Thái Âm thuộc Thủy chủ Thận, Thiên Cơ thuộc Mộc chủ Can Đởm, Thái Dương thuộc Hỏa chủ Tâm & Mắt) để chủ động dưỡng sinh trước khi bệnh khởi phát.',
  },
];

export default function KnowledgeView() {
  const [selectedStar, setSelectedStar] = useState<string>('紫微');
  const [showHanzi, setShowHanzi] = useState<boolean>(false);

  const activeDetail = VI_STAR_DETAILS[selectedStar];

  return (
    <div className="space-y-6">
      {/* Section 1: Master Ni Haixia's 4 Core Principles */}
      <div className="rounded-xl p-5 border bg-[var(--t-card)] border-[var(--t-border)] space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[var(--t-border)]">
          <Compass className="w-4 h-4 text-[var(--t-gold)]" />
          <h2 className="text-sm sm:text-base font-bold text-[var(--t-text)]">
            Tứ Đại Tâm Pháp — Tử Vi Đẩu Số Thiên Kỷ (Nghê Hải Hạ)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {NIHAI_CORE_PRINCIPLES.map((item, idx) => (
            <div
              key={idx}
              className="rounded-lg p-4 border border-[var(--t-border)] bg-[var(--t-surface)] space-y-2"
            >
              <h3 className="text-xs sm:text-sm font-bold text-[var(--t-gold)]">
                {item.title}
              </h3>
              <p className="text-xs font-medium text-[var(--t-text)] leading-relaxed">
                {item.summary}
              </p>
              <p className="text-xs text-[var(--t-text2)] leading-relaxed">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Interactive 14 Major Stars Encyclopedia */}
      <div className="rounded-xl p-5 border bg-[var(--t-card)] border-[var(--t-border)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--t-border)]">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[var(--t-gold)]" />
            <h2 className="text-sm sm:text-base font-bold text-[var(--t-text)]">
              Bách Khoa Thập Tứ Chính Tinh (14 Chính Tinh Bắc Đẩu & Nam Đẩu)
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--t-faint)] hidden sm:inline">
              Chọn sao để tra cứu Cổ Quyết & Tâm Pháp
            </span>
            <button
              type="button"
              onClick={() => setShowHanzi((v) => !v)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
                showHanzi
                  ? 'bg-[var(--t-gold)]/15 border-[var(--t-gold)] text-[var(--t-gold)]'
                  : 'border-[var(--t-border)] text-[var(--t-text2)] hover:text-[var(--t-gold)]'
              }`}
              title="Bật/tắt hiển thị chữ Hán nguyên bản"
            >
              <Languages className="w-3.5 h-3.5" />
              <span>{showHanzi ? 'Ẩn Hán tự' : 'Hán tự'}</span>
            </button>
          </div>
        </div>

        {/* 14 Star Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {MAJOR_STAR_KEYS.map((zh) => {
            const active = selectedStar === zh;
            const info = VI_STAR_DETAILS[zh];
            return (
              <button
                key={zh}
                type="button"
                onClick={() => setSelectedStar(zh)}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  active
                    ? 'bg-[var(--t-gold)]/15 border-[var(--t-gold)] text-[var(--t-gold)]'
                    : 'bg-[var(--t-bg)] border-[var(--t-border)] text-[var(--t-text)] hover:border-[var(--t-gold)]/40'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold">{translateStarName(zh)}</span>
                  {showHanzi && (
                    <span className="text-[11px] font-mono opacity-70">{zh}</span>
                  )}
                </div>
                <div className="text-[10px] text-[var(--t-faint)] truncate mt-0.5">
                  {info?.element}
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Star Detail Card */}
        {activeDetail && (
          <div className="rounded-xl p-4 sm:p-5 border border-[var(--t-gold)]/40 bg-[var(--t-surface)] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--t-border)] pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[var(--t-gold)]">
                  Sao {activeDetail.viName}
                  {showHanzi ? ` (${activeDetail.hanzi})` : ''} — {activeDetail.nature}
                </h3>
                <p className="text-xs text-[var(--t-text2)] mt-0.5">
                  Ngũ hành: <strong>{activeDetail.element}</strong> · Từ khóa:{' '}
                  {activeDetail.keywords.join(' · ')}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-[var(--t-card)] border border-[var(--t-border)] space-y-1">
              <div className="text-xs font-semibold text-[var(--t-gold)] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>Cổ Quyết Tử Vi Đẩu Số Toàn Thư</span>
              </div>
              <p className="text-xs sm:text-sm italic text-[var(--t-text)] leading-relaxed">
                “{activeDetail.classical}”
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-[var(--t-card)] border border-[var(--t-border)] space-y-1">
              <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Luận Giải Thực Chiến — Hệ Thống Thiên Kỷ</span>
              </div>
              <p className="text-xs sm:text-sm text-[var(--t-text)] leading-relaxed">
                {activeDetail.niHaixia}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[var(--t-card)] border border-[var(--t-border)]">
                <div className="font-semibold text-sky-400 mb-1">Sự Nghiệp & Quan Lộc</div>
                <p className="text-[var(--t-text2)] leading-relaxed">{activeDetail.career}</p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--t-card)] border border-[var(--t-border)]">
                <div className="font-semibold text-rose-400 mb-1">Tình Duyên & Gia Đạo</div>
                <p className="text-[var(--t-text2)] leading-relaxed">{activeDetail.relationship}</p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--t-card)] border border-[var(--t-border)]">
                <div className="font-semibold text-amber-400 mb-1">Tài Bạch & Tích Lũy</div>
                <p className="text-[var(--t-text2)] leading-relaxed">{activeDetail.wealth}</p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--t-card)] border border-[var(--t-border)]">
                <div className="font-semibold text-emerald-400 mb-1">Tật Ách & Dưỡng Sinh</div>
                <p className="text-[var(--t-text2)] leading-relaxed">{activeDetail.health}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
