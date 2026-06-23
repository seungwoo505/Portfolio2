const DEFAULT_INSTANCES = 2;

const parseInstances = (value) => {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized) {
    return DEFAULT_INSTANCES;
  }

  if (normalized === "max") {
    return "max";
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_INSTANCES;
};

module.exports = {
  apps: [
    {
      name: process.env.PM2_APP_NAME || "portfolio-server",
      script: "server.ts",
      interpreter: "node",
      node_args: "--import tsx --max-old-space-size=1024",
      instances: parseInstances(process.env.PM2_INSTANCES),
      exec_mode: "cluster",
      watch: false,
      autorestart: true,
      max_memory_restart: process.env.PM2_MAX_MEMORY_RESTART || "1G",
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_file: "./logs/combined.log",
      time: true,
      env: {
        NODE_ENV: "development",
        PORT: process.env.PORT || "3333",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: process.env.PORT || "3333",
      },
    },
  ],
};
