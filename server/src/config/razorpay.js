const Razorpay = require('razorpay');

/**
 * Initializes and exports Razorpay client instance.
 * Reads test credentials from environment variables.
 * Plan Reference: project_plan.md §8, §11.2, §17.1
 */
const getRazorpayInstance = () => {
  const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret';

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

module.exports = {
  getRazorpayInstance,
};
