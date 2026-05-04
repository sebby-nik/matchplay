(function attachEventUtils(root, factory) {
  const api = factory(root.MatchplayStats);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.MatchplayEvents = api;
})(typeof globalThis !== "undefined" ? globalThis : window, (stats) => {
  const asText = stats?.asText || ((value, fallback = "") => {
    if (value === null || value === undefined) return fallback;
    const text = String(value).trim();
    return text || fallback;
  });

  const SERIES_CONFIG = {
    "ryder-cup": {
      name: "Ryder Cup",
      description:
        "Singles matchplay records from the biennial contest between Europe and the United States, including historical Great Britain and Ireland era matches.",
      coverage: "In progress",
      coverageNote: "Singles results are captured across the archive; venue, team score, and edition metadata are still being enriched.",
      teamLabels: ["United States", "Europe / GB&I"]
    },
    "presidents-cup": {
      name: "Presidents Cup",
      description:
        "Singles matchplay records from the United States versus International Team competition.",
      coverage: "Complete",
      coverageNote: "Singles match records are captured for every Presidents Cup edition currently in the dataset.",
      teamLabels: ["United States", "International"]
    },
    "wgc-match-play": {
      name: "WGC Match Play",
      description:
        "Knockout and pool-stage singles matchplay records from the WGC and Dell Match Play era.",
      coverage: "Complete",
      coverageNote: "Completed WGC/Dell Match Play editions in the dataset include player results and match scores."
    },
    "seve-trophy": {
      name: "Seve Trophy",
      description:
        "Singles matchplay records from the Great Britain and Ireland versus Continental Europe team event.",
      coverage: "Complete",
      coverageNote: "Singles match records are captured for the Seve Trophy editions represented in the archive.",
      teamLabels: ["Great Britain & Ireland", "Continental Europe"]
    },
    "eurasia-cup": {
      name: "Eurasia Cup",
      description: "Singles records from the Europe versus Asia matchplay team event.",
      coverage: "Complete",
      coverageNote: "Singles match records are captured for the editions represented in the archive.",
      teamLabels: ["Europe", "Asia"]
    },
    "the-royal-trophy": {
      name: "The Royal Trophy",
      description: "Singles records from the Europe versus Asia matchplay team event.",
      coverage: "Complete",
      coverageNote: "Singles match records are captured for the editions represented in the archive.",
      teamLabels: ["Europe", "Asia"]
    },
    "pga-championship": {
      name: "PGA Championship",
      description: "Historical matchplay-era PGA Championship records before the championship became stroke play.",
      coverage: "Partial",
      coverageNote: "The archive covers the historical matchplay period represented in the current dataset."
    },
    olympics: {
      name: "Olympics",
      description: "Golf matchplay records from Olympic competition represented in the archive.",
      coverage: "Partial",
      coverageNote: "Only the matchplay edition represented in the dataset is currently included."
    },
    "paul-lawrie-match-play": {
      name: "Paul Lawrie Match Play",
      description: "Singles knockout records from the Paul Lawrie Match Play.",
      coverage: "Complete",
      coverageNote: "Completed editions in the dataset include match results and scores."
    },
    "the-world-match-play-championship": {
      name: "The World Match Play Championship",
      description: "Historical singles records from the World Match Play Championship.",
      coverage: "Partial",
      coverageNote: "The current archive includes the editions represented in the source data; metadata enrichment is planned."
    }
  };

  const EVENT_SLUG_ALIASES = {
    "WGC Match Play": "wgc-match-play"
  };

  const slugify = (value) =>
    asText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const getSeriesSlug = (event) => EVENT_SLUG_ALIASES[event] || slugify(event);

  return {
    SERIES_CONFIG,
    EVENT_SLUG_ALIASES,
    slugify,
    getSeriesSlug
  };
});
