function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // API: Check server
    if (path === "/api/health" && request.method === "GET") {
      return json({
        success: true,
        message: "My Lifetime Walk API is running"
      });
    }

    // API: Global leaderboard
    if (path === "/api/leaderboard" && request.method === "GET") {
      try {
        const result = await env.DB.prepare(`
          SELECT
            walker_id,
            ROUND(SUM(km), 2) AS total_km,
            COUNT(*) AS total_walks
          FROM walk_records
          GROUP BY walker_id
          ORDER BY total_km DESC
          LIMIT 100
        `).all();

        return json({
          success: true,
          leaderboard: result.results || []
        });
      } catch (error) {
        return json({
          success: false,
          error: "Could not load leaderboard"
        }, 500);
      }
    }

    // API: Save a walking record
    if (path === "/api/walks" && request.method === "POST") {
      try {
        const body = await request.json();

        const { id, walkerId, km, date, source } = body;

        if (
          typeof id !== "string" ||
          id.length < 1 ||
          id.length > 100 ||
          typeof walkerId !== "string" ||
          walkerId.length < 1 ||
          walkerId.length > 100 ||
          typeof km !== "number" ||
          !Number.isFinite(km) ||
          km <= 0 ||
          km > 500 ||
          typeof date !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          !["manual", "gps"].includes(source)
        ) {
          return json({
            success: false,
            error: "Invalid walking record"
          }, 400);
        }

        await env.DB.prepare(`
          INSERT OR IGNORE INTO walk_records
          (id, walker_id, km, walk_date, source)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
          id,
          walkerId,
          km,
          date,
          source
        ).run();

        return json({
          success: true,
          message: "Walking record received"
        });
      } catch (error) {
        return json({
          success: false,
          error: "Could not save walking record"
        }, 500);
      }
    }

    // Serve website files
    return env.ASSETS.fetch(request);
  }
};
