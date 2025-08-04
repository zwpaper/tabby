import { stripeClient } from "../src/lib/stripe";

async function main() {
  const originPriceId = process.env.ORIGIN_PRICE_ID;
  const targetPriceId = process.env.TARGET_PRICE_ID;
  const isDryRun = !process.argv.includes("--apply");

  if (isDryRun) {
    console.log("--- DRY RUN MODE ---");
    console.log(
      "No actual changes will be made. To apply changes, run with the --apply flag.",
    );
  } else {
    console.log("--- APPLY MODE ---");
    console.log("This will apply changes to your Stripe subscriptions.");
  }

  if (!originPriceId || !targetPriceId) {
    console.error(
      "Please provide ORIGIN_PRICE_ID and TARGET_PRICE_ID environment variables.",
    );
    process.exit(1);
  }

  console.log(`\nSearching for subscriptions with price ID: ${originPriceId}`);
  let foundCount = 0;

  try {
    for await (const subscription of stripeClient.subscriptions.list({
      status: "active",
      expand: ["data.items"],
    })) {
      for (const item of subscription.items.data) {
        if (item.price.id === originPriceId) {
          foundCount++;
          if (isDryRun) {
            console.log(
              `[DRY RUN] Would update item ${item.id} in subscription ${subscription.id} from price ${originPriceId} to ${targetPriceId}.`,
            );
          } else {
            console.log(
              `Updating item ${item.id} in subscription ${subscription.id} from price ${originPriceId} to ${targetPriceId}...`,
            );
            await stripeClient.subscriptionItems.update(item.id, {
              price: targetPriceId,
            });
            console.log(
              `Successfully updated item ${item.id} in subscription ${subscription.id}.`,
            );
          }
        }
      }
    }

    if (foundCount === 0) {
      console.log("No active subscriptions found with the specified price ID.");
    } else {
      if (isDryRun) {
        console.log(
          `\n[DRY RUN] Found ${foundCount} subscription items that would be updated.`,
        );
      } else {
        console.log(`\nSuccessfully updated ${foundCount} subscription items.`);
      }
    }
  } catch (error) {
    console.error("An error occurred during the process:", error);
    process.exit(1);
  }
}

main();
