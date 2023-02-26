import React from "react";
import SetCard from "./setCard";
function Home() {
  return (
    <div className="home-page">
      <div className="welcome-text">
        <h2>Hi, Dong Ngo</h2>
      </div>
      <section>
        <div className="section-header">
          <h5>Recents</h5>
        </div>
        <div className="section-cards">
          <SetCard />
          <SetCard />
          <SetCard />
          <SetCard />
        </div>
      </section>
    </div>
  );
}

export default Home;
