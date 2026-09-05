import { useEffect, useMemo, useState } from 'react';
import { Cpu, MemoryStick, HardDrive, CircuitBoard, Network as NetworkIcon, Zap, Headphones, Thermometer, Laptop, Monitor } from 'lucide-react';
import { StatCard } from '../components/cards/StatCard';
import { UpgradeButton } from '../components/buttons/UpgradeButton';
import { TweakCard } from '../components/cards/TweakCard';
import { HardwareTabs, type HardwareTab } from '../components/hardware/HardwareTabs';
import { HardwareToolbar } from '../components/hardware/HardwareToolbar';
import { DriverInstallerCard } from '../components/hardware/DriverInstallerCard';
import { GpuProfileCard } from '../components/hardware/GpuProfileCard';
import { useCategoryTweaks } from '../hooks/useCategoryTweaks';
import type { HardwareSnapshot } from '../../shared/types';

// Tweak ids surfaced under each sub-tab. The underlying registry only tags
// tweaks as 'hardware' (no finer-grained category yet), so we group them
// here for display rather than inventing a data-model change.
const TAB_TWEAK_IDS: Record<HardwareTab, string[]> = {
  gpu: ['enable-hags', 'disable-game-dvr', 'nvidia-driver-tuning-suite'],
  cpu: [
    'high-performance-power-plan',
    'disable-cpu-power-throttling',
    'set-kernel-worker-threads',
    'set-max-processor-state-100',
    'disable-c-states',
    'energy-performance-preference',
    'disable-modern-standby',
    'set-scheduling-reserve',
    'disable-event-processor',
  ],
  ram: ['disable-prefetcher', 'enable-superfetch', 'disable-page-combining', 'disable-memory-diagnostics-task'],
  peripherals: [
    'disable-mouse-acceleration',
    'disable-usb-selective-suspend',
    'reduce-keyboard-repeat-delay',
    'disable-hidden-usb-power-saving',
  ],
  storage: [
    'disable-storage-idle-timeout',
    'optimize-drives-trim',
    'disable-hipm-dipm-parking',
    'disable-write-cache-buffer-flushing',
    'apply-ssd-ntfs-tweaks',
    'disable-ssd-powersaving',
    'disable-low-latency-cap',
  ],
};

type GpuProfileId = 'laptop' | 'desktop';

function TweakGrid({ ids }: { ids: string[] }) {
  const { tweaks, statuses, busyId, apply, revert } = useCategoryTweaks('hardware');
  const filtered = useMemo(() => tweaks.filter((t) => ids.includes(t.id)), [tweaks, ids]);

  if (filtered.length === 0) {
    return (
      <div className="ft-card p-10 text-center text-sm text-[var(--ft-text-muted)]">
        No tweaks in this section yet — this area is scaffolded for future additions.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {filtered.map((tweak) => (
        <TweakCard
          key={tweak.id}
          tweak={tweak}
          status={statuses[tweak.id] ?? 'unknown'}
          busy={busyId === tweak.id}
          onApply={() => apply(tweak.id)}
          onRevert={() => revert(tweak.id)}
        />
      ))}
    </div>
  );
}

export default function HardwarePage() {
  const [hw, setHw] = useState<HardwareSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<HardwareTab>('gpu');
  const [search, setSearch] = useState('');
  const [activeProfile, setActiveProfile] = useState<GpuProfileId>('desktop');
  const [applyingProfile, setApplyingProfile] = useState<GpuProfileId | null>(null);

  useEffect(() => {
    window.frontier.hardware.getInfo().then((res) => {
      if (res.success) setHw(res.data as HardwareSnapshot);
      setLoading(false);
    });
  }, []);

  const gpuName = loading ? 'Detecting…' : hw?.gpu.map((g) => g.model).join(', ') || 'Unknown GPU';

  const applyProfile = async (id: GpuProfileId) => {
    setApplyingProfile(id);
    // NOTE: NVIDIA Profile Inspector integration isn't implemented yet — this
    // just tracks which profile is selected in the UI until that backend exists.
    await new Promise((r) => setTimeout(r, 400));
    setActiveProfile(id);
    setApplyingProfile(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--ft-text-primary)]">Hardware</h1>
          <p className="text-sm text-[var(--ft-text-secondary)] mt-1">Optimize your hardware performance.</p>
        </div>
        <UpgradeButton />
      </div>

      <HardwareTabs active={tab} onChange={setTab} />

      {tab === 'gpu' && (
        <div className="flex flex-col gap-5">
          <HardwareToolbar
            search={search}
            onSearchChange={setSearch}
            gpuName={gpuName}
            driverVersion={hw?.gpu[0] ? '591.44' : undefined}
          />

          <DriverInstallerCard
            title="Advanced NVIDIA GPU Driver Installer"
            description="Installs a debloated NVIDIA driver. Removes telemetry, unnecessary components and optimizes driver settings."
            warning="Warning"
            onOpen={() => {
              /* Driver installer flow isn't wired up yet — placeholder for the real installer service. */
            }}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <GpuProfileCard
              icon={Laptop}
              title="Frontier Laptop Nvidia Profile"
              description="Applies driver-level optimizations through NVIDIA Profile Inspector. Optimizes global NVIDIA 3d settings and over 80 hidden settings for high performance and low latency without significantly impacting temperatures"
              rows={[
                { icon: Headphones, label: 'Performance & Low Latency', rating: 4 },
                { icon: Thermometer, label: 'Temperature & Power Consumption', rating: 3 },
              ]}
              applied={activeProfile === 'laptop'}
              busy={applyingProfile === 'laptop'}
              onApply={() => applyProfile('laptop')}
            />
            <GpuProfileCard
              icon={Monitor}
              title="Frontier Desktop Nvidia Profile"
              description="Applies driver-level optimizations through NVIDIA Profile Inspector. Optimizes global NVIDIA 3D settings and over 100 hidden settings for maximum performance and ultra low latency."
              rows={[
                { icon: Zap, label: 'Performance & Low Latency', rating: 5 },
                { icon: Thermometer, label: 'Temperature & Power Consumption', rating: 4 },
              ]}
              applied={activeProfile === 'desktop'}
              busy={applyingProfile === 'desktop'}
              onApply={() => applyProfile('desktop')}
            />
          </div>

          <TweakGrid ids={TAB_TWEAK_IDS.gpu} />
        </div>
      )}

      {tab === 'cpu' && (
        <div className="flex flex-col gap-5">
          <StatCard
            icon={Cpu}
            label="CPU"
            value={loading ? 'Detecting…' : hw?.cpu.model ?? 'Unknown'}
            sublabel={hw ? `${hw.cpu.cores} cores · ${hw.cpu.speedGHz} GHz` : undefined}
          />
          <TweakGrid ids={TAB_TWEAK_IDS.cpu} />
        </div>
      )}

      {tab === 'ram' && (
        <div className="flex flex-col gap-5">
          <StatCard
            icon={MemoryStick}
            label="Memory"
            value={loading ? 'Detecting…' : `${hw?.ram.totalGB ?? '—'} GB`}
            sublabel={hw ? `${hw.ram.freeGB} GB free` : undefined}
          />
          <TweakGrid ids={TAB_TWEAK_IDS.ram} />
        </div>
      )}

      {tab === 'peripherals' && (
        <div className="flex flex-col gap-5">
          <TweakGrid ids={TAB_TWEAK_IDS.peripherals} />
        </div>
      )}

      {tab === 'storage' && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatCard
              icon={HardDrive}
              label="Storage"
              value={loading ? 'Detecting…' : hw?.storage.map((s) => `${s.device} (${s.sizeGB}GB)`).join(', ') || 'Unknown'}
            />
            <StatCard
              icon={CircuitBoard}
              label="Motherboard"
              value={loading ? 'Detecting…' : `${hw?.motherboard.manufacturer ?? ''} ${hw?.motherboard.model ?? ''}`.trim() || 'Unknown'}
            />
            <StatCard
              icon={NetworkIcon}
              label="Network Adapter"
              value={loading ? 'Detecting…' : hw?.network.map((n) => n.iface).join(', ') || 'Unknown'}
            />
          </div>
          <TweakGrid ids={TAB_TWEAK_IDS.storage} />
        </div>
      )}
    </div>
  );
}
