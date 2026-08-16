export default function SearchLoading() {
  return (
    <div className="container" style={{ paddingTop: 32 }}>
      <div className="skeleton-line" style={{ width: '40%', height: 28, marginBottom: 24 }} />
      <div className="card-grid">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="restaurant-card">
            <div className="thumb skeleton-block" />
            <div className="body">
              <div className="skeleton-line" style={{ width: '80%' }} />
              <div className="skeleton-line" style={{ width: '50%' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
