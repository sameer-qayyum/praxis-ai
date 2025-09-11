import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - Praxis AI',
  description: 'Terms of Service for Praxis AI - Your agreement for using our AI-powered app generation service.',
};

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Terms of Service
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="prose prose-lg max-w-none dark:prose-invert">
          <div className="space-y-8">
            
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                1. Acceptance of Terms
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                By accessing or using Praxis AI ("Praxis," "we," "our," or "us"), you agree to be bound by these Terms of Service ("Terms"). 
                If you do not agree to these Terms, do not use our service. Praxis is an AI-powered platform that transforms Google Sheets 
                into functional applications using advanced language models and integrates with third-party AI services including V0.dev.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                2. Age and Eligibility
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                You must be at least 16 years of age to use Praxis. By using our service, you represent and warrant that you meet this age requirement. 
                You must provide accurate and complete information during account registration and keep your account information updated. 
                You are responsible for maintaining the confidentiality of your login credentials and for all activities under your account.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                3. Service Description
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                Praxis provides an AI-powered platform that:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
                <li>Connects to your Google Sheets via secure OAuth integration</li>
                <li>Generates functional web applications using AI and natural language processing</li>
                <li>Utilizes third-party AI services including V0.dev for application generation</li>
                <li>Provides templates and guided workflows for common use cases</li>
                <li>Offers hosting and deployment services for generated applications</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                4. License to Use
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Subject to your compliance with these Terms, we grant you a personal, non-exclusive, non-transferable, revocable license 
                to access and use Praxis for your internal business or personal purposes. This license does not include the right to 
                sublicense, distribute, or create derivative works of our service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                5. Your Content and Data
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                You retain ownership of all data, content, and information you provide to Praxis ("Your Content"), including:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300 mb-4">
                <li>Google Sheets data and structure</li>
                <li>Application requirements and prompts</li>
                <li>Generated applications and customizations</li>
                <li>Any other content you upload or create</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                By using Praxis, you grant us a worldwide, non-exclusive, royalty-free license to use, process, and store Your Content 
                solely to provide our services, including processing by AI systems and third-party services like V0.dev. 
                We may remove or disable Your Content at any time for violations of these Terms or applicable law.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                6. AI Services and Third-Party Integration
              </h2>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-6">
                <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">AI Processing Notice</h4>
                <p className="text-blue-800 dark:text-blue-300 text-sm">
                  Praxis utilizes AI services including V0.dev to generate applications. Your data may be processed by these third-party AI systems.
                </p>
              </div>
              
              <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
                <li>We integrate with V0.dev and other AI services to generate applications from your requirements</li>
                <li>Your prompts and data may be processed by these third-party AI systems</li>
                <li>We implement privacy-preserving techniques but cannot guarantee complete data isolation in AI processing</li>
                <li>Third-party AI services have their own terms and privacy policies that may apply</li>
                <li>Generated applications may contain code or components from AI training data</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                7. Free Tier and Paid Plans
              </h2>
              <h3 className="text-xl font-medium text-gray-800 dark:text-gray-200 mb-3">
                7.1 Free Tier
              </h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                We offer a free tier at our sole discretion for personal and non-commercial use. We may change the terms, 
                limitations, or discontinue the free tier at any time. We reserve the right to disable or remove projects 
                on the free tier with or without notice.
              </p>
              
              <h3 className="text-xl font-medium text-gray-800 dark:text-gray-200 mb-3">
                7.2 Paid Plans
              </h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Paid plans provide additional features, higher usage limits, and priority support. Payment terms, 
                refund policies, and plan changes are governed by our billing terms provided at signup.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                8. Acceptable Use
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                You agree not to use Praxis for:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
                <li>Illegal activities or content that violates applicable laws</li>
                <li>Generating applications that infringe intellectual property rights</li>
                <li>Creating malicious software, spam, or harmful content</li>
                <li>Attempting to reverse engineer or compromise our systems</li>
                <li>Violating the terms of service of integrated third-party services</li>
                <li>Generating content that is defamatory, discriminatory, or harmful</li>
                <li>Exceeding rate limits or attempting to abuse our service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                9. Google Services Integration
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                Praxis integrates with Google Services (Sheets, OAuth, Drive). By using these integrations:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
                <li>You must comply with Google's Terms of Service and API policies</li>
                <li>We access only the Google Sheets you explicitly authorize</li>
                <li>You can revoke access at any time through your Google Account settings</li>
                <li>Google's terms and privacy policies apply to your use of Google Services</li>
                <li>We are not responsible for changes to Google's APIs or services</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                10. Intellectual Property
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                Praxis and its technology are protected by intellectual property laws. You acknowledge that:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
                <li>We retain all rights to the Praxis platform and technology</li>
                <li>Generated applications may contain open-source components with their own licenses</li>
                <li>You own the applications generated for you, subject to third-party component licenses</li>
                <li>You grant us feedback rights to improve our service</li>
                <li>We may use aggregated, anonymized usage data for service improvement</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                11. Privacy and Data Protection
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Your privacy is important to us. Our collection, use, and protection of your personal information is governed by our 
                <a href="/privacy" className="text-praxis-600 dark:text-praxis-400 hover:underline"> Privacy Policy</a>, 
                which is incorporated into these Terms by reference.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                12. Service Availability
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                We strive to maintain high service availability but do not guarantee uninterrupted access. We may suspend or 
                discontinue the service for maintenance, updates, or other operational reasons. We are not liable for any 
                downtime or service interruptions.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                13. Disclaimers
              </h2>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
                <p className="text-yellow-800 dark:text-yellow-300 text-sm font-medium mb-2">
                  IMPORTANT DISCLAIMER
                </p>
                <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                  PRAXIS IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DISCLAIM ALL WARRANTIES, 
                  EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. 
                  AI-GENERATED APPLICATIONS MAY CONTAIN ERRORS OR SECURITY VULNERABILITIES.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                14. Limitation of Liability
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, PRAXIS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, 
                SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS, DATA LOSS, OR BUSINESS INTERRUPTION. 
                OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID FOR THE SERVICE IN THE 12 MONTHS PRECEDING THE CLAIM.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                15. Indemnification
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                You agree to indemnify and hold harmless Praxis from any claims, damages, or expenses arising from your use of 
                the service, violation of these Terms, or infringement of third-party rights through your content or applications.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                16. Termination
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                Either party may terminate this agreement at any time:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
                <li>You may delete your account and stop using the service</li>
                <li>We may suspend or terminate your account for violations of these Terms</li>
                <li>Upon termination, your access to the service will cease</li>
                <li>We may retain certain data as required by law or for legitimate business purposes</li>
                <li>Provisions regarding liability, indemnification, and intellectual property survive termination</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                17. Changes to Terms
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                We may update these Terms periodically. We will notify you of material changes by email or through our service. 
                Your continued use of Praxis after changes become effective constitutes acceptance of the updated Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                18. Governing Law
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                These Terms are governed by the laws of [Your Jurisdiction]. Any disputes will be resolved in the courts of 
                [Your Jurisdiction]. If any provision is found unenforceable, the remaining provisions remain in effect.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                19. Contact Information
              </h2>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  If you have questions about these Terms of Service, please contact us:
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                  <li><strong>Email:</strong> <a href="mailto:legal@praxis-ai.com" className="text-praxis-600 dark:text-praxis-400 hover:underline">legal@praxis-ai.com</a></li>
                  <li><strong>Support:</strong> <a href="mailto:support@praxis-ai.com" className="text-praxis-600 dark:text-praxis-400 hover:underline">support@praxis-ai.com</a></li>
                  <li><strong>General:</strong> <a href="mailto:hello@praxis-ai.com" className="text-praxis-600 dark:text-praxis-400 hover:underline">hello@praxis-ai.com</a></li>
                </ul>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
