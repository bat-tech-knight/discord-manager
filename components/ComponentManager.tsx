"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, ChevronDown, Plus } from "lucide-react";

interface Component {
  type: number; // 1 = action row, 2 = button, 3 = select menu
  components: any[];
}

interface ComponentManagerProps {
  components: Component[];
  onComponentsChange: (components: Component[]) => void;
  disabled?: boolean;
}

export function ComponentManager({
  components,
  onComponentsChange,
  disabled,
}: ComponentManagerProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  const addButton = () => {
    const newComponent: Component = {
      type: 1, // Action Row
      components: [
        {
          type: 2, // Button
          style: 1, // Primary
          label: "Button",
          custom_id: `button_${Date.now()}`,
        },
      ],
    };
    onComponentsChange([...components, newComponent]);
    setShowDropdown(false);
  };

  const addSelectMenu = () => {
    const newComponent: Component = {
      type: 1, // Action Row
      components: [
        {
          type: 3, // Select Menu
          custom_id: `select_${Date.now()}`,
          placeholder: "Select an option",
          options: [],
        },
      ],
    };
    onComponentsChange([...components, newComponent]);
    setShowDropdown(false);
  };

  const updateComponent = (index: number, updates: Partial<Component>) => {
    const newComponents = [...components];
    newComponents[index] = { ...newComponents[index], ...updates };
    onComponentsChange(newComponents);
  };

  const removeComponent = (index: number) => {
    onComponentsChange(components.filter((_, i) => i !== index));
  };

  const clearComponents = () => {
    if (components.length > 0 && confirm("Clear all components?")) {
      onComponentsChange([]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative">
          <Button
            onClick={() => setShowDropdown(!showDropdown)}
            disabled={disabled || components.length >= 5}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Component
            <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </Button>
          {showDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowDropdown(false)}
              />
              <div className="absolute top-full left-0 mt-1 w-48 bg-discord-hover border border-discord-hover rounded-lg shadow-lg z-20">
                <button
                  onClick={addButton}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-discord-channel-sidebar rounded-t-lg transition-colors"
                >
                  Button
                </button>
                <button
                  onClick={addSelectMenu}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-discord-channel-sidebar rounded-b-lg transition-colors"
                >
                  Select Menu
                </button>
              </div>
            </>
          )}
        </div>
        {components.length > 0 && (
          <Button
            onClick={clearComponents}
            variant="outline"
            className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
            size="sm"
          >
            Clear Components
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {components.map((component, index) => (
          <ComponentForm
            key={index}
            component={component}
            index={index}
            onUpdate={(updates) => updateComponent(index, updates)}
            onRemove={() => removeComponent(index)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

interface ComponentFormProps {
  component: Component;
  index: number;
  onUpdate: (updates: Partial<Component>) => void;
  onRemove: () => void;
  disabled?: boolean;
}

function ComponentForm({
  component,
  index,
  onUpdate,
  onRemove,
  disabled,
}: ComponentFormProps) {
  const [isOpen, setIsOpen] = useState(true);

  const firstSubComponent = component.components?.[0];

  return (
    <div className="border border-discord-hover rounded-lg overflow-hidden bg-discord-hover/50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 flex items-center justify-between bg-discord-channel-sidebar hover:bg-discord-hover transition-colors"
        disabled={disabled}
      >
        <span className="text-sm font-semibold text-white">
          Component {index + 1} -{" "}
          {firstSubComponent?.type === 2
            ? "Button"
            : firstSubComponent?.type === 3
            ? "Select Menu"
            : "Unknown"}
        </span>
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-discord-text-muted" />
          ) : (
            <ChevronDown className="h-4 w-4 text-discord-text-muted rotate-180" />
          )}
        </div>
      </button>

      {isOpen && firstSubComponent && (
        <div className="p-4 bg-discord-channel-sidebar space-y-3">
          {firstSubComponent.type === 2 && (
            <>
              <div className="space-y-2">
                <Label className="text-xs text-discord-text-secondary">
                  Label
                </Label>
                <Input
                  value={firstSubComponent.label || ""}
                  onChange={(e) => {
                    const newComponents = [...component.components];
                    newComponents[0] = {
                      ...newComponents[0],
                      label: e.target.value,
                    };
                    onUpdate({ components: newComponents });
                  }}
                  className="bg-discord-hover border-discord-hover text-white text-sm"
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-discord-text-secondary">
                  Style
                </Label>
                <select
                  value={firstSubComponent.style || 1}
                  onChange={(e) => {
                    const newComponents = [...component.components];
                    newComponents[0] = {
                      ...newComponents[0],
                      style: parseInt(e.target.value),
                    };
                    onUpdate({ components: newComponents });
                  }}
                  className="w-full bg-discord-hover border border-discord-hover text-white text-sm rounded px-3 py-2"
                  disabled={disabled}
                >
                  <option value={1}>Primary</option>
                  <option value={2}>Secondary</option>
                  <option value={3}>Success</option>
                  <option value={4}>Danger</option>
                  <option value={5}>Link</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-discord-text-secondary">
                  Custom ID
                </Label>
                <Input
                  value={firstSubComponent.custom_id || ""}
                  onChange={(e) => {
                    const newComponents = [...component.components];
                    newComponents[0] = {
                      ...newComponents[0],
                      custom_id: e.target.value,
                    };
                    onUpdate({ components: newComponents });
                  }}
                  className="bg-discord-hover border-discord-hover text-white text-sm"
                  disabled={disabled}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={firstSubComponent.disabled || false}
                  onChange={(e) => {
                    const newComponents = [...component.components];
                    newComponents[0] = {
                      ...newComponents[0],
                      disabled: e.target.checked,
                    };
                    onUpdate({ components: newComponents });
                  }}
                  className="rounded"
                  disabled={disabled}
                />
                <Label className="text-xs text-discord-text-secondary">
                  Disabled
                </Label>
              </div>
            </>
          )}

          {firstSubComponent.type === 3 && (
            <>
              <div className="space-y-2">
                <Label className="text-xs text-discord-text-secondary">
                  Placeholder
                </Label>
                <Input
                  value={firstSubComponent.placeholder || ""}
                  onChange={(e) => {
                    const newComponents = [...component.components];
                    newComponents[0] = {
                      ...newComponents[0],
                      placeholder: e.target.value,
                    };
                    onUpdate({ components: newComponents });
                  }}
                  className="bg-discord-hover border-discord-hover text-white text-sm"
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-discord-text-secondary">
                  Custom ID
                </Label>
                <Input
                  value={firstSubComponent.custom_id || ""}
                  onChange={(e) => {
                    const newComponents = [...component.components];
                    newComponents[0] = {
                      ...newComponents[0],
                      custom_id: e.target.value,
                    };
                    onUpdate({ components: newComponents });
                  }}
                  className="bg-discord-hover border-discord-hover text-white text-sm"
                  disabled={disabled}
                />
              </div>
              <div className="text-xs text-discord-text-muted">
                Note: Options configuration is not implemented in this basic
                version.
              </div>
            </>
          )}

          <Button
            onClick={onRemove}
            variant="ghost"
            size="sm"
            className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/20 w-full"
            disabled={disabled}
          >
            <X className="h-3 w-3 mr-1" />
            Remove Component
          </Button>
        </div>
      )}
    </div>
  );
}

