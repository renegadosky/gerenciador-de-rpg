import { Icon } from '../components/Icon';

export default function SoonPage({ title, stage, text }: { title: string; stage: string; text: string }) {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <div className="max-w-sm">
        <Icon name="layers" size={28} className="mx-auto mb-3 text-g-500" />
        <div className="text-lg font-semibold">{title}</div>
        <div className="mb-2 text-xs uppercase tracking-wider text-accent">{stage} do plano</div>
        <p className="text-sm text-g-400">{text} O banco de dados já tem as tabelas prontas; falta a interface.</p>
      </div>
    </div>
  );
}
