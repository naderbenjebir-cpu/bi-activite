export default function Error({ statusCode }) {
  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h2>Erreur {statusCode || 'client'}</h2>
    </div>
  );
}

Error.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};
