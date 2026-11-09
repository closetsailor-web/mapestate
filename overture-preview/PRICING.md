# Game estimates

These are game prices for this preview. They are not real property values, not listings, and not purchases. The page does not charge a wallet or change a saved game.

The residential figure is the game's current house or unit value at week 0, with no waterfront premium and no bedroom adjustment. The game leaves the bedroom multiplier at 1 when a lot has no bedroom count, and this preview does not invent one.

The regional profile median is $703,000 for a house and $495,000 for a unit. This extract is the central sample, so the City Centre suburb multiplier of 0.78 applies. A house then scales by its measured footprint against the game's typical 220 m², with the game's 0.3 power and the 0.7 to 1.6 clamp. A unit uses the game's size factor of 1.1, which is both the floor and the cap, so a larger or smaller apartment footprint does not change that estimate. Each building also gets the game's own spread, `0.9 + hash(game id) × 0.2`, and the week-0 market index for Coralwood suburb 0. The release boost is 1 because no neighbouring suburb is unlocked. The result is rounded to the nearest $1,000, which is what `value()` does.

Commercial buildings take that house estimate and add a fixed uplift between 30% and 40%. The exact step is stored in basis points on the game id in `data/pricing-v1.json`. Reloading the page reads that file. Changing only the vendor id does not change the game id, so it does not pick a new uplift. The displayed commercial amount is the nearest whole dollar.

Every other classified building uses the same house estimate with an extra adjustment of 0. That 0 is the configured default and is pending review. It is not an agreed premium.

A building with no class and no subtype, or a roof, shed, garage, carport, or outbuilding, has no game estimate. It is not treated as a home. Grey quarantined overlaps stay unsaleable and are not in the pricing file. Showing an estimate and being able to buy are separate. This page does not enable claims, trades, or listings.

In the eventual game, only an actual player owner could list a rental or a room share, and a room share would be one or two rooms. This preview does not generate those listings.

The map colours shapes from the stored grouping and does not show a type name or a legend. The registry file and its 1,058 game ids and 35 quarantines are unchanged.
