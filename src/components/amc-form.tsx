// src/components/amc-form.tsx

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { AmcFormValues, MOCK_AMC_MONTHS, AmcStatus, EntityOption } from '@/types/amc';
import { InputWithSuggestions } from '@/components/ui/input-with-suggestions';


// --- ZOD Schema (No Change) ---
const formSchema = z.object({
    dealer: z.string().min(1, { message: 'Dealer is required.' }),
    customer: z.string().min(1, { message: 'Customer is required.' }),
    newDealerName: z.string().optional(),
    newCustomerName: z.string().optional(),
    description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
    status: z.enum(['Active', 'Expired', 'Extension']),
    amcFrom: z.string().date('Invalid start date format.').min(1, { message: 'Start date is required.' }),
    amcTo: z.string().date('Invalid end date format.').min(1, { message: 'End date is required.' }),
    amcMonth: z.enum(MOCK_AMC_MONTHS),
}).superRefine((data, ctx) => {
    // Custom validation for 'New Entry' fields
    if (data.dealer === 'new' && (!data.newDealerName || data.newDealerName.trim().length === 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['newDealerName'], message: 'New Dealer name is required when selecting "New Entry".', });
    }
    if (data.customer === 'new' && (!data.newCustomerName || data.newCustomerName.trim().length === 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['newCustomerName'], message: 'New Customer name is required when selecting "New Entry".', });
    }
});


// --- AmcFormProps (No Change) ---
interface AmcFormProps {
    initialData?: Partial<AmcFormValues>;
    onSubmit: (data: AmcFormValues) => Promise<void>;
    isSubmitting: boolean;
    dealerOptions: EntityOption[];
    customerOptions: EntityOption[];
}


export function AmcForm({
    initialData,
    onSubmit,
    isSubmitting,
    dealerOptions,
    customerOptions
}: AmcFormProps) {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: initialData || {
            dealer: '',
            customer: '',
            description: '',
            status: 'Active' as AmcStatus,
            amcFrom: '',
            amcTo: '',
            amcMonth: 'JAN' as typeof MOCK_AMC_MONTHS[number],
            newDealerName: '',
            newCustomerName: '',
        },
    });

    const handleSubmit = async (values: z.infer<typeof formSchema>) => {
        await onSubmit(values as AmcFormValues);

        // Reset form after successful submission
        form.reset({
            dealer: '',
            customer: '',
            description: '',
            status: 'Active' as AmcStatus,
            amcFrom: '',
            amcTo: '',
            amcMonth: 'JAN' as typeof MOCK_AMC_MONTHS[number],
            newDealerName: '',
            newCustomerName: '',
        });
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-4 p-4 border-t-[2px]">

                {/* --- Dealer Input/Dropdown (SINGLE FIELD) --- */}
                <FormField
                    control={form.control}
                    name="dealer" // Binds to the ID field
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Dealer</FormLabel>
                            {/* Inner FormField manages the input text for new creation/display */}
                            <FormField
                                control={form.control}
                                name="newDealerName"
                                render={({ field: newEntryField }) => (
                                    <InputWithSuggestions
                                        options={dealerOptions}
                                        placeholder="Type to search or create new dealer"
                                        // Pass the ID field's state
                                        fieldValue={field.value}
                                        fieldOnChange={field.onChange}
                                        // Pass the NEW ENTRY TEXT field's state
                                        newEntryValue={newEntryField.value || ''}
                                        newEntryOnChange={newEntryField.onChange}
                                    />
                                )}
                            />
                            <FormMessage />
                        </FormItem>
                    )}
                />


                {/* --- Customer Input/Dropdown (SINGLE FIELD) --- */}
                <FormField
                    control={form.control}
                    name="customer" // Binds to the ID field
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Customer</FormLabel>
                            {/* Inner FormField manages the input text for new creation/display */}
                            <FormField
                                control={form.control}
                                name="newCustomerName"
                                render={({ field: newEntryField }) => (
                                    <InputWithSuggestions
                                        options={customerOptions}
                                        placeholder="Type to search or create new customer"
                                        // Pass the ID field's state
                                        fieldValue={field.value}
                                        fieldOnChange={field.onChange}
                                        // Pass the NEW ENTRY TEXT field's state
                                        newEntryValue={newEntryField.value || ''}
                                        newEntryOnChange={newEntryField.onChange}
                                    />
                                )}
                            />
                            <FormMessage />
                        </FormItem>
                    )}
                />


                {/* --- Status Dropdown --- */}
                <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>AMC Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {['Active', 'Expired', 'Extension'].map(s => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex space-x-4">
                    {/* --- AMC From Date --- */}
                    <FormField
                        control={form.control}
                        name="amcFrom"
                        render={({ field }) => (
                            <FormItem className="flex-1">
                                <FormLabel>AMC From</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* --- AMC To Date --- */}
                    <FormField
                        control={form.control}
                        name="amcTo"
                        render={({ field }) => (
                            <FormItem className="flex-1">
                                <FormLabel>AMC To</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                {/* --- AMC Month Dropdown --- */}
                <FormField
                    control={form.control}
                    name="amcMonth"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>AMC Month</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select AMC month" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {MOCK_AMC_MONTHS.map(m => (
                                        <SelectItem key={m} value={m}>{m}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />


                {/* --- Description (Multiline) --- */}
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Enter a detailed description of the AMC..." {...field} rows={4} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />


                <Button type="submit" className="w-full !bg-black !hover:bg-sky-600 !text-white" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : (initialData ? 'Update AMC Info' : 'Create AMC Info')}
                </Button>
            </form>
        </Form>
    );
}