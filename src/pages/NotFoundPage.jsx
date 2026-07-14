import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="center-msg" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>404</div>
      <h2>Página não encontrada</h2>
      <p style={{ color: 'var(--text-light)', margin: '0.5rem 0 1.5rem' }}>
        A página que você procura não existe ou foi movida.
      </p>
      <Link to="/" className="pagination-btn" style={{ textDecoration: 'none' }}>
        Voltar para o início
      </Link>
    </div>
  );
}
