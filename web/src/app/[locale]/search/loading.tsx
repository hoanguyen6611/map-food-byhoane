export default function SearchLoading() {
  return (
    <div className="container container-wide search-layout">
      <div className="search-sidebar">
        <div className="skeleton-block" style={{ height: 420, borderRadius: 14 }} />
      </div>
      <div className="search-main">
        <div className="skeleton-line" style={{ width: '40%', height: 28, marginBottom: 8 }} />
        <div className="result-grid-1">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="place-row">
              <div className="place-row-thumb skeleton-block" style={{ width: 88, height: 88 }} />
              <div className="place-row-body">
                <div className="skeleton-line" style={{ width: '70%' }} />
                <div className="skeleton-line" style={{ width: '40%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
