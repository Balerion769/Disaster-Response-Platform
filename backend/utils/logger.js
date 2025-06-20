// Simple structured logger
export const logAction = (action, details = {}) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    ...details,
  };
  console.log(JSON.stringify(logEntry));
};