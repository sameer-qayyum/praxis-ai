import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - Praxis AI',
  description: 'Privacy Policy for Praxis AI - Learn how we protect your data and privacy.',
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Privacy Policy
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="prose prose-lg max-w-none dark:prose-invert">
          <div className="space-y-8">
            
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                1. Introduction
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Welcome to Praxis AI ("we," "our," or "us"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered text-to-app generation service. Praxis AI transforms your Google Sheets into functional applications using artificial intelligence and natural language processing.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                2. Information We Collect
              </h2>
              
              <h3 className="text-xl font-medium text-gray-800 dark:text-gray-200 mb-3">
                2.1 Personal Information
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
                <li>Email address for account creation and communication</li>
                <li>Name and contact information you provide</li>
                <li>Payment information (processed securely through third-party providers)</li>
                <li>Profile information and preferences</li>
              </ul>

              <h3 className="text-xl font-medium text-gray-800 dark:text-gray-200 mb-3 mt-6">
                2.2 Google Sheets Data
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
                <li>Google Sheets content you choose to connect to Praxis</li>
                <li>Column names, data structure, and sample data</li>
                <li>Google account authentication tokens (stored securely)</li>
                <li>Metadata about your sheets and applications</li>
              </ul>

              <h3 className="text-xl font-medium text-gray-800 dark:text-gray-200 mb-3 mt-6">
                2.3 Usage Data
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
                <li>App generation requests and prompts</li>
                <li>Usage patterns and feature interactions</li>
                <li>Device information and browser data</li>
                <li>IP addresses and location data</li>
                <li>Performance and error logs</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                3. How We Use Your Information
              </h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
                <li><strong>Service Delivery:</strong> Generate applications from your Google Sheets data</li>
                <li><strong>AI Processing:</strong> Train and improve our AI models for better app generation</li>
                <li><strong>Authentication:</strong> Manage your account and secure access to Google services</li>
                <li><strong>Communication:</strong> Send service updates, support responses, and feature announcements</li>
                <li><strong>Analytics:</strong> Understand usage patterns to improve our service</li>
                <li><strong>Security:</strong> Detect and prevent fraud, abuse, and security threats</li>
                <li><strong>Legal Compliance:</strong> Meet regulatory requirements and legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                4. AI and Data Processing
              </h2>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-6">
                <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Important AI Processing Notice</h4>
                <p className="text-blue-800 dark:text-blue-300 text-sm">
                  Your data may be processed by AI systems to generate applications. We implement privacy-preserving techniques and do not use your personal data to train models accessible to other users.
                </p>
              </div>
              
              <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
                <li>Your Google Sheets data is processed to understand structure and generate appropriate applications</li>
                <li>AI models analyze your prompts and requirements to create custom apps</li>
                <li>We may use aggregated, anonymized data to improve our AI capabilities</li>
                <li>Personal data is never shared with other users or used in publicly accessible models</li>
                <li>All AI processing follows industry-standard privacy and security practices</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                5. Data Sharing and Disclosure
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We do not sell your personal information. We may share your information in the following circumstances:
              </p>
              
              <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
                <li><strong>Service Providers:</strong> Third-party vendors who assist in service delivery (Google APIs, hosting providers, payment processors)</li>
                <li><strong>Legal Requirements:</strong> When required by law, court order, or government request</li>
                <li><strong>Business Transfers:</strong> In connection with mergers, acquisitions, or asset sales</li>
                <li><strong>Safety and Security:</strong> To protect rights, property, or safety of users and the public</li>
                <li><strong>Consent:</strong> With your explicit permission for specific purposes</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                6. Google Services Integration
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Praxis integrates with Google Services (Sheets, Drive, OAuth). Our use of Google APIs adheres to Google's API Services User Data Policy:
              </p>
              
              <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
                <li>We only access Google Sheets you explicitly authorize</li>
                <li>Google authentication tokens are stored securely and encrypted</li>
                <li>We comply with Google's Limited Use requirements</li>
                <li>You can revoke access at any time through your Google Account settings</li>
                <li>We do not store unnecessary Google data beyond what's required for service functionality</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                7. Data Security
              </h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
                <li>Industry-standard encryption for data in transit and at rest</li>
                <li>Secure authentication and access controls</li>
                <li>Regular security audits and vulnerability assessments</li>
                <li>Employee access controls and privacy training</li>
                <li>Incident response procedures for data breaches</li>
                <li>Compliance with SOC 2 and other security frameworks</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                8. Your Rights and Choices
              </h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
                <li><strong>Access:</strong> Request copies of your personal information</li>
                <li><strong>Correction:</strong> Update or correct inaccurate information</li>
                <li><strong>Deletion:</strong> Request deletion of your personal data</li>
                <li><strong>Portability:</strong> Export your data in a machine-readable format</li>
                <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
                <li><strong>Restrict Processing:</strong> Limit how we use your information</li>
                <li><strong>Revoke Consent:</strong> Withdraw permission for data processing</li>
              </ul>
              
              <p className="text-gray-700 dark:text-gray-300 mt-4">
                To exercise these rights, contact us at <a href="mailto:privacy@praxis-ai.com" className="text-praxis-600 dark:text-praxis-400 hover:underline">privacy@praxis-ai.com</a>
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                9. Data Retention
              </h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
                <li>Account data: Retained while your account is active and for 30 days after deletion</li>
                <li>Google Sheets data: Processed temporarily and not permanently stored unless required for app functionality</li>
                <li>Usage logs: Retained for 12 months for security and analytics purposes</li>
                <li>Generated applications: Retained as long as you maintain your account</li>
                <li>Legal requirements may extend retention periods in some cases</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                10. International Data Transfers
              </h2>
              <p className="text-gray-700 dark:text-gray-300">
                Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place, including Standard Contractual Clauses and adequacy decisions, to protect your data during international transfers.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                11. Children's Privacy
              </h2>
              <p className="text-gray-700 dark:text-gray-300">
                Praxis AI is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                12. Changes to This Privacy Policy
              </h2>
              <p className="text-gray-700 dark:text-gray-300">
                We may update this Privacy Policy periodically. We will notify you of material changes by email or through our service. Your continued use of Praxis AI after changes become effective constitutes acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                13. Contact Information
              </h2>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  If you have questions about this Privacy Policy or our data practices, please contact us:
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                  
                  <li><strong>Support:</strong> <a href="mailto:support@praxis-ai.com" className="text-praxis-600 dark:text-praxis-400 hover:underline">support@praxis-ai.com</a></li>
                </ul>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
