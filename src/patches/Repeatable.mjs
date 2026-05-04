import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import * as React from 'react';
import { useNotification, useField, useForm, createRulesEngine, useIsDesktop } from '@strapi/admin/strapi-admin';
import { Accordion, TextButton, Box, VisuallyHidden, useComposedRefs, IconButton, Flex, Searchbar } from '@strapi/design-system';
import { Plus, Trash, Drag, ArrowUp, ArrowDown } from '@strapi/icons';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { useIntl } from 'react-intl';
import { useLocation } from 'react-router-dom';
import { styled } from 'styled-components';
import { ItemTypes } from '../../../../../constants/dragAndDrop.mjs';
import { useDocumentContext } from '../../../../../hooks/useDocumentContext.mjs';
import { useDragAndDrop } from '../../../../../hooks/useDragAndDrop.mjs';
import { usePrev } from '../../../../../hooks/usePrev.mjs';
import { getIn } from '../../../../../utils/objects.mjs';
import { getTranslation } from '../../../../../utils/translations.mjs';
import { transformDocument } from '../../../utils/data.mjs';
import { createDefaultForm } from '../../../utils/forms.mjs';
import { ResponsiveGridRoot, ResponsiveGridItem } from '../../FormLayout.mjs';
import { useComponent, ComponentProvider } from '../ComponentContext.mjs';
import { Initializer } from './Initializer.mjs';

const getItemDisplayLabel = (itemData, mainField)=>{
    if (!itemData || typeof itemData !== 'object') return '';
    const directVal = itemData[mainField?.name];
    if (directVal != null && directVal !== '' && typeof directVal !== 'object') return String(directVal);
    if (itemData._preview) return String(itemData._preview);
    const titlesArr = itemData.titles;
    const subTitlesArr = itemData.subTitles;
    const title = Array.isArray(titlesArr) && titlesArr.length > 0 ? titlesArr[0]?.content : null;
    const subTitle = Array.isArray(subTitlesArr) && subTitlesArr.length > 0 ? subTitlesArr[0]?.content : null;
    if (title && subTitle) return title + ' - ' + subTitle;
    if (title) return title;
    if (subTitle) return subTitle;
    if (typeof itemData.code === 'string' && itemData.code) return itemData.code;
    if (typeof itemData.name === 'string' && itemData.name) return itemData.name;
    if (typeof itemData.title === 'string' && itemData.title) return itemData.title;
    if (typeof itemData.content === 'string' && itemData.content) return itemData.content;
    if (typeof itemData.layout === 'string' && itemData.layout) return itemData.layout;
    if (typeof itemData.action === 'string' && itemData.action) return itemData.action;
    if (typeof itemData.role === 'string' && itemData.role) return itemData.role;
    return '';
};

const RepeatableComponent = ({ attribute, disabled, name, mainField, children, layout })=>{
    const { toggleNotification } = useNotification();
    const { formatMessage } = useIntl();
    const { search: searchString } = useLocation();
    const search = React.useMemo(()=>new URLSearchParams(searchString), [searchString]);
    const { currentDocument } = useDocumentContext('RepeatableComponent');
    const components = currentDocument.components;
    const { value = [], error, rawError } = useField(name);
    const addFieldRow = useForm('RepeatableComponent', (state)=>state.addFieldRow);
    const moveFieldRow = useForm('RepeatableComponent', (state)=>state.moveFieldRow);
    const removeFieldRow = useForm('RepeatableComponent', (state)=>state.removeFieldRow);
    const { max = Infinity } = attribute;
    const [collapseToOpen, setCollapseToOpen] = React.useState('');
    const [liveText, setLiveText] = React.useState('');
    const rulesEngine = createRulesEngine();

    React.useEffect(()=>{
        const hasNestedErrors = rawError && Array.isArray(rawError) && rawError.length > 0;
        const hasNestedValue = value && Array.isArray(value) && value.length > 0;
        if (hasNestedErrors && hasNestedValue) {
            const errorOpenItems = rawError.map((_, idx)=>{
                return value[idx] ? value[idx].__temp_key__ : null;
            }).filter((value)=>!!value);
            if (errorOpenItems && errorOpenItems.length > 0) {
                setCollapseToOpen((collapseToOpen)=>{
                    if (!errorOpenItems.includes(collapseToOpen)) {
                        return errorOpenItems[0];
                    }
                    return collapseToOpen;
                });
            }
        }
    }, [rawError, value]);

    const componentTmpKeyWithFocussedField = React.useMemo(()=>{
        if (search.has('field')) {
            const fieldParam = search.get('field');
            if (!fieldParam) return undefined;
            const [, path] = fieldParam.split(`${name}.`);
            if (getIn(value, path, undefined) !== undefined) {
                const [subpath] = path.split('.');
                return getIn(value, subpath, undefined)?.__temp_key__;
            }
        }
        return undefined;
    }, [search, name, value]);

    const prevValue = usePrev(value);
    React.useEffect(()=>{
        if (prevValue && prevValue.length < value.length) {
            setCollapseToOpen(value[value.length - 1].__temp_key__);
        }
    }, [value, prevValue]);

    React.useEffect(()=>{
        if (typeof componentTmpKeyWithFocussedField === 'string') {
            setCollapseToOpen(componentTmpKeyWithFocussedField);
        }
    }, [componentTmpKeyWithFocussedField]);

    const toggleCollapses = ()=>{ setCollapseToOpen(''); };

    const handleClick = ()=>{
        if (value.length < max) {
            const schema = components[attribute.component];
            const form = createDefaultForm(schema, components);
            const data = transformDocument(schema, components)(form);
            addFieldRow(name, data);
        } else if (value.length >= max) {
            toggleNotification({
                type: 'info',
                message: formatMessage({ id: getTranslation('components.notification.info.maximum-requirement') })
            });
        }
    };

    const handleCloneComponent = (index)=>{
        if (value.length >= max) {
            toggleNotification({
                type: 'info',
                message: formatMessage({ id: getTranslation('components.notification.info.maximum-requirement') })
            });
            return;
        }
        const sourceData = value[index];
        const cloned = JSON.parse(JSON.stringify(sourceData));
        delete cloned.__temp_key__;
        delete cloned.id;
        addFieldRow(name, cloned);
        if (value.length > 0) {
            setTimeout(()=>moveFieldRow(name, value.length, index + 1), 0);
        }
    };

    const handleMoveComponentField = (newIndex, currentIndex)=>{
        setLiveText(formatMessage({
            id: getTranslation('dnd.reorder'),
            defaultMessage: '{item}, moved. New position in list: {position}.'
        }, { item: `${name}.${currentIndex}`, position: getItemPos(newIndex) }));
        moveFieldRow(name, currentIndex, newIndex);
    };

    const handleValueChange = (key)=>{ setCollapseToOpen(key); };
    const getItemPos = (index)=>`${index + 1} of ${value.length}`;

    const handleCancel = (index)=>{
        setLiveText(formatMessage({
            id: getTranslation('dnd.cancel-item'),
            defaultMessage: '{item}, dropped. Re-order cancelled.'
        }, { item: `${name}.${index}` }));
    };
    const handleGrabItem = (index)=>{
        setLiveText(formatMessage({
            id: getTranslation('dnd.grab-item'),
            defaultMessage: `{item}, grabbed. Current position in list: {position}. Press up and down arrow to change position, Spacebar to drop, Escape to cancel.`
        }, { item: `${name}.${index}`, position: getItemPos(index) }));
    };
    const handleDropItem = (index)=>{
        setLiveText(formatMessage({
            id: getTranslation('dnd.drop-item'),
            defaultMessage: `{item}, dropped. Final position in list: {position}.`
        }, { item: `${name}.${index}`, position: getItemPos(index) }));
    };

    const ariaDescriptionId = React.useId();
    const level = useComponent('RepeatableComponent', (state)=>state.level);
    const [searchFilter, setSearchFilter] = React.useState('');
    const formValues = useForm('RepeatableComponent', (state)=>state.values);

    const itemLabels = React.useMemo(()=>{
        return value.map((item, idx)=>{
            const basePath = name.split('.');
            basePath.push(String(idx));
            const itemData = getIn(formValues, basePath);
            const label = getItemDisplayLabel(itemData, mainField);
            return label || `Item ${idx + 1}`;
        });
    }, [value, formValues, name, mainField]);

    const filteredIndices = React.useMemo(()=>{
        if (!searchFilter.trim()) return null;
        const query = searchFilter.toLowerCase().trim();
        const indices = [];
        value.forEach((item, idx)=>{
            if (itemLabels[idx].toLowerCase().includes(query)) indices.push(idx);
        });
        return indices;
    }, [searchFilter, value, itemLabels]);

    if (value.length === 0) {
        return /*#__PURE__*/ jsx(Initializer, { disabled: disabled, name: name, onClick: handleClick });
    }

    return /*#__PURE__*/ jsxs(Box, {
        hasRadius: true,
        children: [
            /*#__PURE__*/ jsx(VisuallyHidden, {
                id: ariaDescriptionId,
                children: formatMessage({ id: getTranslation('dnd.instructions'), defaultMessage: `Press spacebar to grab and re-order` })
            }),
            /*#__PURE__*/ jsx(VisuallyHidden, { "aria-live": "assertive", children: liveText }),
            value.length >= 3 && /*#__PURE__*/ jsx(Box, {
                paddingLeft: 3, paddingRight: 3, paddingTop: 2, paddingBottom: 2,
                children: /*#__PURE__*/ jsx(Searchbar, {
                    name: `${name}-search`,
                    placeholder: formatMessage({ id: 'component-preview.search', defaultMessage: 'Filter items...' }),
                    value: searchFilter,
                    onChange: (e)=>setSearchFilter(e.target.value),
                    onClear: ()=>setSearchFilter(''),
                    children: formatMessage({ id: 'component-preview.search.label', defaultMessage: 'Filter' })
                })
            }),
            filteredIndices !== null && /*#__PURE__*/ jsx(Box, {
                paddingLeft: 3, paddingRight: 3, paddingBottom: 1,
                children: /*#__PURE__*/ jsx("span", {
                    style: { fontSize: '1.2rem', color: '#a5a5ba' },
                    children: `${filteredIndices.length} / ${value.length} items`
                })
            }),
            /*#__PURE__*/ jsxs(AccordionRoot, {
                $error: error,
                value: collapseToOpen,
                onValueChange: handleValueChange,
                "aria-describedby": ariaDescriptionId,
                children: [
                    value.map(({ __temp_key__: key, id, ...currentComponentValues }, index)=>{
                        if (filteredIndices !== null && !filteredIndices.includes(index)) return null;
                        const nameWithIndex = `${name}.${index}`;
                        return /*#__PURE__*/ jsx(Box, {
                            id: `repeatable-item-${key}`,
                            children: /*#__PURE__*/ jsx(ComponentProvider, {
                                id: id,
                                uid: attribute.component,
                                level: level + 1,
                                type: "repeatable",
                                children: /*#__PURE__*/ jsx(Component, {
                                    disabled: disabled,
                                    name: nameWithIndex,
                                    attribute: attribute,
                                    index: index,
                                    mainField: mainField,
                                    onMoveItem: handleMoveComponentField,
                                    onDeleteComponent: ()=>{ removeFieldRow(name, index); toggleCollapses(); },
                                    onCloneComponent: ()=>{ handleCloneComponent(index); },
                                    toggleCollapses: toggleCollapses,
                                    onCancel: handleCancel,
                                    onDropItem: handleDropItem,
                                    onGrabItem: handleGrabItem,
                                    __temp_key__: key,
                                    totalLength: value.length,
                                    children: layout.map((row, index)=>{
                                        const visibleFields = row.filter(({ ...field })=>{
                                            const condition = field.attribute.conditions?.visible;
                                            if (condition) return rulesEngine.evaluate(condition, currentComponentValues);
                                            return true;
                                        });
                                        if (visibleFields.length === 0) return null;
                                        return /*#__PURE__*/ jsx(ResponsiveGridRoot, {
                                            gap: 4,
                                            children: visibleFields.map(({ size, ...field })=>{
                                                const completeFieldName = `${nameWithIndex}.${field.name}`;
                                                const translatedLabel = formatMessage({
                                                    id: `content-manager.components.${attribute.component}.${field.name}`,
                                                    defaultMessage: field.label
                                                });
                                                return /*#__PURE__*/ jsx(ResponsiveGridItem, {
                                                    col: size, s: 12, xs: 12,
                                                    direction: "column", alignItems: "stretch",
                                                    children: children({ ...field, label: translatedLabel, name: completeFieldName, document: currentDocument })
                                                }, completeFieldName);
                                            })
                                        }, index);
                                    })
                                })
                            })
                        }, key);
                    }),
                    /*#__PURE__*/ jsx(TextButtonCustom, {
                        disabled: disabled,
                        onClick: handleClick,
                        startIcon: /*#__PURE__*/ jsx(Plus, {}),
                        children: formatMessage({ id: getTranslation('containers.EditView.add.new-entry'), defaultMessage: 'Add an entry' })
                    })
                ]
            })
        ]
    });
};

const AccordionRoot = styled(Accordion.Root)`
  border: 1px solid ${({ theme, $error })=>$error ? theme.colors.danger600 : theme.colors.neutral200};
`;
const TextButtonCustom = styled(TextButton)`
  width: 100%;
  display: flex;
  justify-content: center;
  border-top: 1px solid ${({ theme })=>theme.colors.neutral200};
  padding-inline: ${(props)=>props.theme.spaces[6]};
  padding-block: ${(props)=>props.theme.spaces[3]};
  &:not([disabled]) { cursor: pointer; &:hover { background-color: ${(props)=>props.theme.colors.primary100}; } }
  span { font-weight: 600; font-size: 1.4rem; line-height: 2.4rem; }
  @media (prefers-reduced-motion: no-preference) { transition: background-color 120ms ${(props)=>props.theme.motion.easings.easeOutQuad}; }
`;

const Component = ({ disabled, index, name, mainField = { name: 'id', type: 'integer' }, children, onDeleteComponent, onCloneComponent, toggleCollapses, __temp_key__, totalLength, onMoveItem, ...dragProps })=>{
    const { formatMessage } = useIntl();
    const isDesktop = useIsDesktop();
    const displayValue = useForm('RepeatableComponent', (state)=>{
        const basePath = name.split('.');
        const value = getIn(state.values, [...basePath, mainField.name]);
        if (value != null && value !== '' && typeof value !== 'object') return value;
        const componentData = getIn(state.values, basePath);
        if (componentData && typeof componentData === 'object') {
            if (componentData._preview) return componentData._preview;
            const titlesArr = componentData.titles;
            const subTitlesArr = componentData.subTitles;
            const title = Array.isArray(titlesArr) && titlesArr.length > 0 ? titlesArr[0]?.content : null;
            const subTitle = Array.isArray(subTitlesArr) && subTitlesArr.length > 0 ? subTitlesArr[0]?.content : null;
            if (title && subTitle) return title + ' - ' + subTitle;
            if (title) return title;
            if (subTitle) return subTitle;
            if (typeof componentData.code === 'string' && componentData.code) return componentData.code;
            if (typeof componentData.name === 'string' && componentData.name) return componentData.name;
            if (typeof componentData.title === 'string' && componentData.title) return componentData.title;
            if (typeof componentData.content === 'string' && componentData.content) return componentData.content;
            if (typeof componentData.layout === 'string' && componentData.layout) return componentData.layout;
            if (typeof componentData.action === 'string' && componentData.action) return componentData.action;
            if (typeof componentData.role === 'string' && componentData.role) return componentData.role;
        }
        return value;
    });

    const accordionRef = React.useRef(null);
    const componentKey = name.split('.').slice(0, -1).join('.');
    const [{ handlerId, isDragging, handleKeyDown }, boxRef, dropRef, dragRef, dragPreviewRef] = useDragAndDrop(!disabled, {
        type: `${ItemTypes.COMPONENT}_${componentKey}`,
        index,
        item: { index, displayedValue: displayValue },
        onStart() { toggleCollapses(); },
        onMoveItem,
        ...dragProps
    });

    React.useEffect(()=>{
        dragPreviewRef(getEmptyImage(), { captureDraggingState: false });
    }, [dragPreviewRef, index]);

    const composedAccordionRefs = useComposedRefs(accordionRef, dragRef);
    const composedBoxRefs = useComposedRefs(boxRef, dropRef);

    const handleMoveUp = React.useCallback((e)=>{
        e.stopPropagation();
        if (index > 0 && onMoveItem) onMoveItem(index - 1, index);
    }, [index, onMoveItem]);

    const handleMoveDown = React.useCallback((e)=>{
        e.stopPropagation();
        if (index < totalLength - 1 && onMoveItem) onMoveItem(index + 1, index);
    }, [index, totalLength, onMoveItem]);

    const canMoveUp = index > 0;
    const canMoveDown = index < totalLength - 1;

    return /*#__PURE__*/ jsx(Fragment, {
        children: isDragging ? /*#__PURE__*/ jsx(Preview, {}) : /*#__PURE__*/ jsxs(Accordion.Item, {
            ref: composedBoxRefs,
            value: __temp_key__,
            children: [
                /*#__PURE__*/ jsxs(Accordion.Header, {
                    children: [
                        /*#__PURE__*/ jsx(Accordion.Trigger, { children: displayValue }),
                        /*#__PURE__*/ jsxs(Accordion.Actions, {
                            children: [
                                /*#__PURE__*/ jsx(IconButton, {
                                    disabled: disabled,
                                    variant: "ghost",
                                    onClick: onDeleteComponent,
                                    label: formatMessage({ id: getTranslation('containers.Edit.delete'), defaultMessage: 'Delete' }),
                                    children: /*#__PURE__*/ jsx(Trash, {})
                                }),
                                isDesktop && /*#__PURE__*/ jsx(IconButton, {
                                    disabled: disabled,
                                    ref: composedAccordionRefs,
                                    variant: "ghost",
                                    onClick: (e)=>e.stopPropagation(),
                                    "data-handler-id": handlerId,
                                    label: formatMessage({ id: getTranslation('components.DragHandle-label'), defaultMessage: 'Drag' }),
                                    onKeyDown: handleKeyDown,
                                    children: /*#__PURE__*/ jsx(Drag, {})
                                }),
                                !isDesktop && /*#__PURE__*/ jsxs(Fragment, {
                                    children: [
                                        canMoveUp && /*#__PURE__*/ jsx(IconButton, {
                                            disabled: disabled || !canMoveUp,
                                            variant: "ghost",
                                            onClick: handleMoveUp,
                                            label: formatMessage({ id: getTranslation('components.DynamicZone.move-up'), defaultMessage: 'Move up' }),
                                            children: /*#__PURE__*/ jsx(ArrowUp, {})
                                        }),
                                        canMoveDown && /*#__PURE__*/ jsx(IconButton, {
                                            disabled: disabled || !canMoveDown,
                                            variant: "ghost",
                                            onClick: handleMoveDown,
                                            label: formatMessage({ id: getTranslation('components.DynamicZone.move-down'), defaultMessage: 'Move down' }),
                                            children: /*#__PURE__*/ jsx(ArrowDown, {})
                                        })
                                    ]
                                })
                            ]
                        })
                    ]
                }),
                /*#__PURE__*/ jsx(Accordion.Content, {
                    children: /*#__PURE__*/ jsx(Flex, {
                        direction: "column", alignItems: "stretch", background: "neutral100",
                        padding: { initial: 4, medium: 6 }, gap: { initial: 3, medium: 4 },
                        children: children
                    })
                })
            ]
        })
    });
};

const Preview = ()=>{
    return /*#__PURE__*/ jsx(StyledSpan, { tag: "span", padding: 6, background: "primary100" });
};
const StyledSpan = styled(Box)`
  display: block;
  outline: 1px dashed ${({ theme })=>theme.colors.primary500};
  outline-offset: -1px;
`;

export { RepeatableComponent };
//# sourceMappingURL=Repeatable.mjs.map
