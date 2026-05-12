import { FormActionsRow } from "@/components/form-field/form-actions-row";
import { IntervalSliderField } from "@/components/form-field/interval-slider-field";
import { LabeledRadioOption } from "@/components/form-field/labeled-radio-option";
import { InfoTooltip } from "@/components/info-tool-tip/info-tool-tip";
import {
  RenderAlternatively,
  RenderConditionally,
} from "@/components/render-elements";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui-kits/accordion/accordion";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Input } from "@/components/ui-kits/input/input";
import { RadioGroup } from "@/components/ui-kits/radio-group/radio-group";
import { Switch } from "@/components/ui-kits/switch/switch";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import {
  HTTP_METHODS,
  MONITOR_INTERVAL_TICKS,
  MONITOR_INTERVAL_TOOLTIP,
  MONITOR_TYPE_OPTIONS,
  REQUEST_JSON_TOOLTIP,
  TIMEOUT_TOOLTIP,
} from "@/cross-modules/deployment/constants/alert.constant";
import { type FormEventHandler } from "react";
import type { UseFormReturn } from "react-hook-form";
import type {
  MonitorConfigurationType,
  MonitorFormMode,
  MonitorFormValues,
} from "./schema";

type MonitorFormFieldsProps = {
  form: UseFormReturn<MonitorFormValues>;
  mode: MonitorFormMode;
  onSubmit: FormEventHandler<HTMLFormElement>;
  monitorType: MonitorConfigurationType;
  isSubmitting: boolean;
  isEditMode: boolean;
  onMonitorTypeChange: (value: MonitorConfigurationType) => void;
  isSourceBlocked?: boolean;
};

export const MonitorFormFields = ({
  form,
  onSubmit,
  monitorType,
  isSubmitting,
  isEditMode,
  onMonitorTypeChange,
  isSourceBlocked = false,
}: MonitorFormFieldsProps) => {
  const httpMethod = form.watch("requestConfiguration.http_methods");
  const sendAsJson = form.watch("requestConfiguration.json_switcher");

  return (
    <Form {...form}>
      <form onSubmit={onSubmit}>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-2">
          <RenderConditionally condition={!isEditMode}>
            <FormField
              control={form.control}
              name="monitorConfigurationType"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-1">
                  <FormLabel className="block text-sm font-medium">
                    Monitor type
                  </FormLabel>
                  <FormControl className="flex items-center gap-2">
                    <RadioGroup
                      value={field.value}
                      onValueChange={(value: MonitorConfigurationType) => {
                        field.onChange(value);
                        onMonitorTypeChange(value);
                      }}
                      className="flex items-center gap-4"
                      disabled={isEditMode}>
                      {MONITOR_TYPE_OPTIONS.map((option) => (
                        <LabeledRadioOption
                          key={option.id}
                          id={option.id}
                          value={option.value}
                          label={option.label}
                          disabled={isEditMode}
                        />
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </RenderConditionally>

          <div className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={isEditMode}
                      onBlur={(e) => {
                        field.onChange(e.target.value.trim());
                        field.onBlur();
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <RenderConditionally condition={monitorType === "request"}>
              <FormField
                control={form.control}
                name="urlMonitor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL to monitor</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isEditMode} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </RenderConditionally>
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="monitorSettings">
              <AccordionTrigger className="flex-row-reverse justify-end gap-4 hover:no-underline">
                Monitor settings
              </AccordionTrigger>
              <AccordionContent className="flex flex-col gap-4 px-1 pt-1">
                <IntervalSliderField
                  control={form.control}
                  name="monitorSettings.monitor_interval"
                  label="Monitor interval"
                  tooltipContent={MONITOR_INTERVAL_TOOLTIP}
                  tickLabels={MONITOR_INTERVAL_TICKS}
                />

                <RenderAlternatively condition={monitorType === "request"}>
                  <IntervalSliderField
                    control={form.control}
                    name="monitorSettings.request_timeout"
                    label="Request timeout"
                    tooltipContent={TIMEOUT_TOOLTIP}
                    tickLabels={MONITOR_INTERVAL_TICKS}
                  />

                  <IntervalSliderField
                    control={form.control}
                    name="monitorSettings.grace_time"
                    label="Grace Time"
                    tooltipContent={TIMEOUT_TOOLTIP}
                    tickLabels={MONITOR_INTERVAL_TICKS}
                  />
                </RenderAlternatively>
              </AccordionContent>
            </AccordionItem>

            <RenderConditionally condition={monitorType === "request"}>
              <AccordionItem value="requestConfig">
                <AccordionTrigger className="flex-row-reverse justify-end gap-4 hover:no-underline">
                  Request Configuration
                </AccordionTrigger>
                <AccordionContent className="flex flex-col gap-4 px-1 pt-1">
                  <FormField
                    control={form.control}
                    name="requestConfiguration.http_methods"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>HTTP method</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex flex-col gap-4">
                            <div className="flex gap-6">
                              {HTTP_METHODS.map((item) => (
                                <LabeledRadioOption
                                  key={`http-method-${item.value}`}
                                  id={`http-method-${item.value}`}
                                  value={item.value}
                                  label={item.label}
                                />
                              ))}
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="requestConfiguration.request_body"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Request body</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter request body content..."
                            rows={3}
                            disabled={httpMethod !== "2"}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="requestConfiguration.json_switcher"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <FormLabel className="flex items-center gap-2">
                          Send as JSON (application/json)
                          <InfoTooltip content={REQUEST_JSON_TOOLTIP} />
                        </FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="!mt-0"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <RenderConditionally condition={sendAsJson}>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <span className="text-lg font-semibold md:col-span-2">
                        Request headers
                      </span>

                      <FormField
                        control={form.control}
                        name="requestConfiguration.x_header_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>X-Header-Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="requestConfiguration.value"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Value</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </RenderConditionally>
                </AccordionContent>
              </AccordionItem>
            </RenderConditionally>
          </Accordion>

          <FormActionsRow
            cancelLabel="Cancel"
            saveLabel="Save"
            isSaveDisabled={
              isSubmitting || !form.formState.isValid || !!isSourceBlocked
            }
          />
        </div>
      </form>
    </Form>
  );
};
