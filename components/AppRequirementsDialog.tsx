'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';

interface AppRequirementsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AppRequirementsDialog({ open, onOpenChange }: AppRequirementsDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    appRequirements: '',
    sheetColumnNames: '',
    sampleData: ''
  });

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Parse column names into array
      const columnNames = formData.sheetColumnNames
        .split(',')
        .map(name => name.trim())
        .filter(name => name.length > 0);

      // Parse sample data as JSON if provided
      let sampleDataJson = null;
      if (formData.sampleData.trim()) {
        try {
          sampleDataJson = JSON.parse(formData.sampleData);
        } catch {
          // If not valid JSON, store as simple object
          sampleDataJson = { raw_data: formData.sampleData };
        }
      }

      const { error } = await supabase
        .from('app_requirements_submissions')
        .insert({
          email: formData.email,
          app_requirements: formData.appRequirements,
          sheet_column_names: columnNames,
          sample_data: sampleDataJson
        });

      if (error) throw error;

      setIsSuccess(true);
      // Reset form after 3 seconds
      setTimeout(() => {
        setIsSuccess(false);
        setFormData({
          email: '',
          appRequirements: '',
          sheetColumnNames: '',
          sampleData: ''
        });
        onOpenChange(false);
      }, 3000);

    } catch (error) {
      console.error('Error submitting form:', error);
      alert('There was an error submitting your request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (isSuccess) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md border-0 shadow-xl">
          <div className="text-center py-12 px-6">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              🎉 Request Submitted Successfully!
            </h3>
            <div className="space-y-3 text-gray-700 dark:text-gray-300">
              <p className="text-base leading-relaxed">
                Thank you for choosing Praxis! We've received your app requirements and are excited to build something amazing for you.
              </p>
              <div className="bg-praxis-50 dark:bg-praxis-900/20 rounded-lg p-4 mt-4">
                <p className="text-sm font-medium text-praxis-800 dark:text-praxis-200 mb-2">
                  What happens next:
                </p>
                <ul className="text-sm text-praxis-700 dark:text-praxis-300 space-y-1 text-left">
                  <li>• We'll review your requirements within 2-4 hours</li>
                  <li>• Our team will start building your app immediately</li>
                  <li>• You'll receive an email with your app link very soon</li>
                  <li>• Remember: This is completely free as promised!</li>
                </ul>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
                Keep an eye on your inbox - we'll be in touch very soon! 📧
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl border-0 shadow-xl">
        <DialogHeader className="text-center pb-4">
          <div className="w-10 h-10 bg-praxis-100 dark:bg-praxis-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-praxis-600 dark:text-praxis-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100">Let's build your app using Praxis!</DialogTitle>
          <DialogDescription className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Tell us about your Google Sheet and what you need. We'll build it for free and get back to you in 24 hours.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-gray-800 dark:text-gray-200">Your email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className="h-10 border-2 focus:border-praxis-500 transition-colors"
              required
            />
          </div>

          {/* App Requirements */}
          <div className="space-y-2">
            <Label htmlFor="requirements" className="text-sm font-medium text-gray-800 dark:text-gray-200">What kind of app do you need? *</Label>
            <Textarea
              id="requirements"
              placeholder="I need a customer dashboard where clients can view their orders..."
              value={formData.appRequirements}
              onChange={(e) => handleInputChange('appRequirements', e.target.value)}
              className="min-h-[80px] border-2 focus:border-praxis-500 transition-colors resize-none"
              required
            />
            <p className="text-xs text-gray-600 dark:text-gray-400">
              💡 Be specific about what you want your app to do
            </p>
          </div>

          {/* Sheet Column Names */}
          <div className="space-y-2">
            <Label htmlFor="columns" className="text-sm font-medium text-gray-800 dark:text-gray-200">Google Sheet columns <span className="text-gray-500 dark:text-gray-400 font-normal">(optional)</span></Label>
            <Input
              id="columns"
              placeholder="Name, Email, Phone, Order Date, Status"
              value={formData.sheetColumnNames}
              onChange={(e) => handleInputChange('sheetColumnNames', e.target.value)}
              className="h-10 border-2 focus:border-praxis-500 transition-colors"
            />
            <p className="text-xs text-gray-600 dark:text-gray-400">
              📊 List your column names separated by commas
            </p>
          </div>

          {/* Sample Data */}
          <div className="space-y-2">
            <Label htmlFor="sampleData" className="text-sm font-medium text-gray-800 dark:text-gray-200">Sample data <span className="text-gray-500 dark:text-gray-400 font-normal">(optional)</span></Label>
            <Textarea
              id="sampleData"
              placeholder="John Doe, john@email.com, 555-0123, 2024-01-15, Completed"
              value={formData.sampleData}
              onChange={(e) => handleInputChange('sampleData', e.target.value)}
              className="min-h-[70px] border-2 focus:border-praxis-500 transition-colors resize-none"
            />
            <p className="text-xs text-gray-600 dark:text-gray-400">
              📝 A few example rows help us understand your data
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="px-6 h-10 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.email || !formData.appRequirements}
              className="flex-1 h-10 font-medium bg-praxis-600 hover:bg-praxis-700 dark:bg-praxis-500 dark:hover:bg-praxis-600 shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Submitting...
                </div>
              ) : (
                'Submit Request →'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
