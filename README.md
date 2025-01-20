
# Sky Flow - Backend

This is the backend for the **Sky Flow**, a full-stack building management system, built with Express, MongoDB, and integrated with Stripe for payment processing. The system includes features for user management, apartment bookings, agreements, and role-based access control.

## Features

- User authentication using JWT and cookies.
- Role-based access control (admin, member, and user).
- Apartment management system.
- Agreement handling and status updates.
- Payment system integration via Stripe.
- Coupon management and validation.
- Admin functionalities to manage users and agreements.

## Technologies Used

- **Express** - Web framework for Node.js.
- **MongoDB** - NoSQL database for storing user and apartment data.
- **JWT** - JSON Web Token for user authentication.
- **Stripe** - Payment gateway for processing payments.
- **Nodemailer** - For sending emails.
- **Cookie-parser** - For handling cookies.
- **CORS** - For cross-origin requests.
- **dotenv** - For environment variable management.

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- MongoDB account and database (create a free MongoDB Atlas account if you don’t have one)
- Stripe account for payment integration

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/your-username/sabbir-project.git
   ```

2. Navigate to the project directory:

   ```bash
   cd sabbir-project
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Set up environment variables by creating a `.env` file in the root directory with the following keys:

   ```plaintext
   DB_USER=your_mongo_user
   DB_PASS=your_mongo_password
   STRIPE_SECRET_KEY=your_stripe_secret_key
   SECRECT_KEY=your_jwt_secret_key
   NODE_ENV=development
   ```

### Running the Server

To run the server locally, use:

```bash
npm start
```

The server will start on port 9000 by default. You can access the API at `http://localhost:9000`.

### API Endpoints

#### Authentication

- `POST /jwt` - Generate a JWT token and set a cookie.
- `POST /logout` - Log out and clear the JWT token cookie.

#### User Management

- `POST /users/:email` - Create or update a user.
- `GET /users/role/:email` - Get the role of a user.
- `GET /users/profile` - Get the profile of the authenticated user.

#### Apartments

- `GET /apartments` - Get a list of apartments (limit 6).
- `GET /allapartments` - Get all apartments with pagination.
- `GET /apartments/:id` - Get details of a specific apartment.

#### Agreements

- `POST /agreement` - Create a new agreement request.
- `PATCH /agreements/update/:id` - Update agreement status (approve/reject).
- `PATCH /agreements/reject/:id` - Reject an agreement request.

#### Payment

- `POST /create-payment-intent` - Create a payment intent with Stripe.

#### Coupons

- `GET /coupons` - Get all available coupons.
- `GET /coupons/:code` - Validate a coupon by its code.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- MongoDB Atlas for database hosting.
- Stripe for payment processing.
- Express for the backend framework.
- JWT for authentication management.

