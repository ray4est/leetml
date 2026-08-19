import Link from "next/link";
import { handwrittenDigitExercise } from "@/lib/exercise";
import { DIGIT_READER_PATH, learningPath } from "@/lib/learning-path";
import styles from "./LearningPath.module.css";

function Compass() {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="Explorer compass">
      <circle cx="24" cy="24" r="20" />
      <circle cx="24" cy="24" r="3" />
      <path d="m29.8 18.2-3.7 7.9-7.9 3.7 3.7-7.9 7.9-3.7Z" />
      <path d="M24 4v4M24 40v4M4 24h4M40 24h4" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="3" />
      <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
    </svg>
  );
}

function TrailArtwork() {
  return (
    <svg
      className={styles.trailArtwork}
      viewBox="0 0 1000 1640"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        className={styles.trailShadow}
        d="M500 48 C500 150 256 152 250 310 S742 465 746 635 267 775 256 956 740 1090 742 1265 508 1408 500 1590"
      />
      <path
        className={styles.trailLine}
        d="M500 48 C500 150 256 152 250 310 S742 465 746 635 267 775 256 956 740 1090 742 1265 508 1408 500 1590"
      />
    </svg>
  );
}

export function LearningPath() {
  return (
    <main className={styles.page}>
      <div className={styles.aurora} aria-hidden="true" />
      <header className={styles.nav}>
        <Link className={styles.brand} href="/" aria-label="LeetML learning path">
          <span className={styles.brandMark}>LM</span>
          <span>leetml</span>
        </Link>
        <div className={styles.navTrail} aria-hidden="true">
          <span />
          Learning path
        </div>
        <Link className={styles.campLink} href={DIGIT_READER_PATH} prefetch={false}>
          Enter camp
          <span aria-hidden="true">↗</span>
        </Link>
      </header>

      <section className={styles.hero} aria-labelledby="adventure-title">
        <div className={styles.heroCopy}>
          <div className={styles.kicker}>
            <span className={styles.kickerLine} />
            LeetML expedition one
          </div>
          <h1 id="adventure-title">
            Your machine learning
            <span>adventure starts here.</span>
          </h1>
          <p>
            Cross five wild regions, train real models, and turn every mistake into a clue on your
            way to the Storyforge Summit.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href={DIGIT_READER_PATH} prefetch={false}>
              Start first quest
              <span aria-hidden="true">→</span>
            </Link>
            <a className={styles.secondaryAction} href="#trail-map">
              View the map
            </a>
          </div>
        </div>

        <div className={styles.heroScene} aria-hidden="true">
          <div className={`${styles.orbit} ${styles.orbitOne}`} />
          <div className={`${styles.orbit} ${styles.orbitTwo}`} />
          <div className={styles.compass}>
            <Compass />
          </div>
          <div className={`${styles.mountain} ${styles.mountainBack}`} />
          <div className={`${styles.mountain} ${styles.mountainFront}`} />
          <div className={styles.summitFlag}>ML</div>
          <div className={styles.sceneLabel}>
            <span>Destination</span>
            <strong>Storyforge Summit</strong>
            <small>5 quests ahead</small>
          </div>
        </div>
      </section>

      <section className={styles.expeditionStatus} aria-label="Expedition status">
        <div>
          <span className={styles.statusIcon}>✦</span>
          <span>
            Explorer rank
            <strong>Trailhead</strong>
          </span>
        </div>
        <div>
          <span className={styles.statusNumber}>1</span>
          <span>
            Trail open
            <strong>4 being built</strong>
          </span>
        </div>
        <div className={styles.routeKey}>
          <span><i className={styles.readyKey} /> Ready to explore</span>
          <span><i className={styles.buildingKey} /> Beyond the frontier</span>
        </div>
      </section>

      <section className={styles.mapSection} id="trail-map" aria-labelledby="trail-title">
        <div className={styles.mapHeading}>
          <p>Choose your trail</p>
          <h2 id="trail-title">The path to the summit</h2>
          <span>Each quest unlocks a new way to make machines learn.</span>
        </div>

        <div className={styles.map}>
          <TrailArtwork />
          <ol className={styles.questList}>
            {learningPath.map((quest) => {
              const isReady = quest.status === "ready";
              return (
                <li
                  className={`${styles.quest} ${isReady ? styles.questReady : styles.questBuilding}`}
                  key={quest.number}
                >
                  <span className={styles.mapPin} aria-hidden="true">
                    {isReady ? quest.number : <LockIcon />}
                  </span>
                  <article className={styles.questCard}>
                    <div className={styles.cardTopline}>
                      <span>Quest {String(quest.number).padStart(2, "0")}</span>
                      <span className={styles.questStatus}>
                        {isReady ? "Ready to play" : "Being built"}
                      </span>
                    </div>
                    <p className={styles.region}>{quest.region}</p>
                    <h3>{quest.title}</h3>
                    <p className={styles.questDescription}>{quest.description}</p>

                    {isReady ? (
                      <div className={styles.digitQuestPreview}>
                        <div
                          className={styles.digitGrid}
                          role="img"
                          aria-label={`An 8 by 8 grayscale image of handwritten digit ${handwrittenDigitExercise.sampleLabel}`}
                        >
                          {handwrittenDigitExercise.sampleImage.map((brightness, index) => (
                            <span
                              key={index}
                              style={{
                                backgroundColor: `rgba(243, 250, 242, ${0.04 + (brightness / 16) * 0.96})`,
                              }}
                            />
                          ))}
                        </div>
                        <div>
                          <span className={styles.topic}>{quest.topic}</span>
                          <strong>Can your model read this?</strong>
                          <small>Train, test, inspect mistakes, repeat.</small>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.futurePreview}>
                        <span className={styles.topic}>{quest.topic}</span>
                        <span className={styles.lockedReward}>
                          <LockIcon /> {quest.reward}
                        </span>
                      </div>
                    )}

                    <div className={styles.cardFooter}>
                      <span className={styles.reward}>
                        <span aria-hidden="true">✦</span> {quest.reward}
                      </span>
                      {isReady && quest.href ? (
                        <Link className={styles.questAction} href={quest.href} prefetch={false}>
                          Begin quest <span aria-hidden="true">→</span>
                        </Link>
                      ) : (
                        <span className={styles.buildingAction} aria-disabled="true">
                          Trail closed
                        </span>
                      )}
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>
          <div className={styles.summit} aria-hidden="true">
            <span>▲</span>
            Summit
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div>
          <span className={styles.brandMark}>LM</span>
          <span>
            Built for curious minds.
            <small>Learn by building things that work.</small>
          </span>
        </div>
        <Link href={DIGIT_READER_PATH} prefetch={false}>
          Begin at Pixel Pass <span aria-hidden="true">→</span>
        </Link>
      </footer>
    </main>
  );
}
