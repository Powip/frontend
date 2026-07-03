import { GoogleSheetsConfigView } from './components/GoogleSheetsConfigView';

export const metadata = {
  title: 'Configuración Google Sheets | Powip',
  description: 'Automatiza la carga de pedidos vinculando tu cuenta de Google Sheets.',
};

export default function GoogleSheetsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container py-10">
        <GoogleSheetsConfigView />
      </div>
    </main>
  );
}
