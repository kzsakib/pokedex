export default function AbilityList({ abilities }) {
  if (!abilities?.length) return null;

  return (
    <section className="abilities" aria-labelledby="abilities-title">
      <div className="abilities-head">
        <h4 className="stats-title" id="abilities-title">
          Abilities
        </h4>
        <p className="stats-total">{abilities.length} on record</p>
      </div>
      <ul className="ability-list">
        {abilities.map((ability) => (
          <li key={ability.name} className="ability">
            <p className="ability-name">
              {ability.label}
              {ability.hidden && (
                <span className="ability-tag">Hidden</span>
              )}
            </p>
            <p className="ability-text">{ability.text || "No description on record."}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
