# Feature Planning Document: Property/Item Ownership System

## 1. Overview & Objectives

The "Property/Item Ownership" system introduces a realistic asset economy into the Cosmos Casino ecosystem. Users will be able to purchase, pawn, or sell real-world items (properties) using their in-game casino funds. The primary objective is to create a dynamic liquidity system where users can store their wealth in assets and liquidate them when needed, driven by an AI-assisted negotiation and depreciation logic. This bridges the gap between gambling winnings and tangible in-game asset accumulation.

## 2. Core Mechanics

### Purchasing Mechanics

- **Property Acquisition**: Users can browse a catalog of available real-world properties.
- **Normal Price**: Properties are bought at a standard market price ("Normal Price").
- **Funding**: Purchases are made using the user's in-game account balance, which is accrued through casino gambling or other economic activities.
- **Inventory Integration**: Upon successful purchase, the property is immediately transferred to the user's personal inventory.

### Selling & Pawning Mechanics (Depreciation System)

- **Liquidity Options**: Users facing a shortage of funds or wishing to liquidate assets can sell or pawn their properties back to the "Bank" or the "Cosmos Casino Operator".
- **Depreciation Rule**: The core economic rule is that selling or pawning a property will _always_ yield a lower return than the original purchase price, simulating real-world depreciation and transaction fees.
- **Automated Calculation**: An automated calculation system determines the baseline deal price based on variable depreciation rates (e.g., 1%, 1.5%, or 2% applied dynamically based on asset type, market conditions, or holding period).

### AI-Assisted Negotiation

- **Automated Broker**: When a user initiates a sell or pawn request, they interact with an AI broker.
- **Dynamic Pricing**: The AI uses the baseline calculated depreciation price as a starting point.
- **User Interaction**: Users can attempt to negotiate a slightly better deal within predefined bounds. The AI will accept, reject, or counter-offer based on its prompt parameters and the asset's hidden depreciation logic, up to a hard cap.

## 3. Data Models / Schema

### User Inventory (Property Instances)

Tracks the individual assets currently owned by a user. This ensures each property has its specific required attributes accurately represented.

- `inventory_id` (UUID) - Primary Key
- `user_id` (UUID) - Foreign Key to User
- `property_id` (UUID) - Foreign Key to Property Catalog
- `name` (String) - e.g., "Honda Scoopy Motorcycle"
- `type_category` (String) - e.g., "Fashion/Sporty"
- `original_price` (Decimal) - e.g., OTR price of Rp23,100,000 (The price the user actually paid)
- `ownership_status` (Enum) - e.g., 'Owned', 'Pawned', 'Sold'
- `purchase_date` (Timestamp)

### Property Catalog

Defines the base attributes of all purchasable items.

- `property_id` (UUID)
- `name` (String)
- `type_category` (String)
- `base_price` (Decimal) - Standard Normal Price
- `base_depreciation_rate` (Decimal) - Standard depreciation applied

### Transaction History

Logs all purchases, sales, and pawning actions for economic tracking.

- `transaction_id` (UUID)
- `user_id` (UUID)
- `property_id` (UUID)
- `transaction_type` (Enum: Buy, Sell, Pawn)
- `amount` (Decimal)
- `timestamp` (Timestamp)
- `ai_negotiation_log` (JSON) - Summary of the negotiation outcome and conversation

## 4. Economic Logic

### Depreciation Calculation

The baseline offer price before negotiation is calculated as:
`Base Offer = Original Price * (1 - Depreciation Rate)`

- **Depreciation Rate**: A variable percentage (e.g., 1%, 1.5%, 2%) determined by the system based on `type_category` and market factors.
- _Example_: A Honda Scoopy bought for an `original_price` of Rp23,100,000 with a total 2% depreciation would have a baseline offer of Rp22,638,000.

### AI Negotiation Logic

1.  **System Prompt Boundaries**: The AI is strictly prompted to act as a pawn shop broker for Cosmos Casino.
2.  **Hard Programmatic Cap (Crucial Rule Enforcement)**: To ensure the selling/pawning price is _always_ lower than the original purchase price (regardless of AI hallucination or prompt injection), the system enforces a strict programmatic cap. The final `Deal Price` can _never_ exceed `Original Price * 0.99` (enforcing at least a 1% depreciation).
3.  **Haggling Dynamics**: The AI starts at the `Base Offer`. If the user negotiates, the AI evaluates the user's prompt (e.g., persuasion tactics) and can concede slightly, up to the Hard Cap.

### Economic Flow (Post-Sale)

1.  **Agreement**: Once the `Deal Price` is accepted by both the user and the AI (and passes validation).
2.  **Transfer**: The property is removed from `User Inventory` (if sold) or marked as 'Pawned' (locked until bought back).
3.  **Credit**: The `Deal Price` amount is instantly credited to the user's main casino balance.
4.  **Re-entry**: The user immediately has liquidity to return to gambling or spend in the future Item Shop.

## 5. Future Considerations

- **Integration with Item Shop**: The post-sale balance will be directly usable in the upcoming "Item Shop" system. Funds credited to the user's balance from a pawn/sale immediately increase their purchasing power for items.
- **Buyback/Loan Repayment (Pawning)**: If a property's `ownership_status` is 'Pawned', a future module must handle users repaying the pawn value plus interest to regain 'Owned' status within a time limit. If not repaid, the status defaults to 'Sold' to the bank.
