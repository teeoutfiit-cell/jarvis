import './globals.css';

export const metadata = {
  title: 'JARVIS',
  description: 'Assistente de voz pessoal'
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
