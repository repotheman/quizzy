import { defineConfig } from '@prisma/config'

export default defineConfig({
  datasource: {
    url: 'postgresql://neondb_owner:npg_D3coiv7OjmFC@ep-floral-term-aotnmq31-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  },
})
