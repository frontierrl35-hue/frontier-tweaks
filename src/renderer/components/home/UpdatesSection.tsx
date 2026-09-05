import { Megaphone } from 'lucide-react';

// Static placeholder tiles — there's no real news/updates feed wired up yet.
// Swap the gradients for real thumbnails once that content source exists.
const UPDATES = [
  { title: "What's new", gradient: 'linear-gradient(135deg, #2a2a3a 0%, #6b6b85 100%)' },
  { title: 'Community spotlight', gradient: 'linear-gradient(135deg, #3a1f10 0%, #ff7a3d 100%)' },
  { title: 'Guides & tips', gradient: 'linear-gradient(135deg, #0f2540 0%, #2f7bdb 100%)' },
];

export function UpdatesSection() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-[var(--ft-text-primary)]">
        <Megaphone size={16} className="text-[var(--ft-accent-2)]" />
        <span className="text-sm font-semibold">Updates</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {UPDATES.map((u) => (
          <div
            key={u.title}
            className="ft-card overflow-hidden aspect-video flex items-end p-4"
            style={{ backgroundImage: u.gradient }}
          >
            <span className="text-sm font-semibold text-white drop-shadow">{u.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
