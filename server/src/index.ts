import 'express-async-errors';
import { app } from './app';

const PORT = Number(process.env.SERVER_PORT) || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV ?? 'development'}]`);
});
