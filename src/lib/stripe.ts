import Stripe from "stripe"

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set — check .env.local")
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia",
  typescript: true,
  appInfo: {
    name: "Expansion Agency Dashboard",
  },
})

export const isStripeTestMode = process.env.STRIPE_SECRET_KEY.startsWith(
  "sk_test_",
)
