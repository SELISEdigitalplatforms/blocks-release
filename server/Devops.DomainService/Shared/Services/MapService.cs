using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Devops.DomainService.Shared.Interfaces;

namespace Devops.DomainService.Shared.Services
{
    public static class MapService
    {
        private static readonly Dictionary<string, PropertyInfo[]> _propertyCache = new();

        /// <summary>
        /// Maps properties from source object to a new instance of destination type
        /// </summary>
        /// <typeparam name="TSource">Source object type</typeparam>
        /// <typeparam name="TDestination">Destination object type</typeparam>
        /// <param name="source">Source object instance</param>
        /// <returns>New instance of destination type with mapped properties</returns>
        public static TDestination Map<TSource, TDestination>(TSource source) where TDestination : class, new()
        {
            if (source == null)
                return null;

            var destination = new TDestination();
            return Map(source, destination);
        }

        /// <summary>
        /// Maps properties from source object to existing destination object
        /// </summary>
        /// <typeparam name="TSource">Source object type</typeparam>
        /// <typeparam name="TDestination">Destination object type</typeparam>
        /// <param name="source">Source object instance</param>
        /// <param name="destination">Destination object instance</param>
        /// <returns>Destination object with mapped properties</returns>
        public static TDestination Map<TSource, TDestination>(TSource source, TDestination destination) where TDestination : class
        {
            if (source == null || destination == null)
                return destination;

            var sourceType = typeof(TSource);
            var destinationType = typeof(TDestination);

            var sourceProperties = GetProperties(sourceType);
            var destinationProperties = GetProperties(destinationType);

            foreach (var destProp in destinationProperties)
            {
                if (!destProp.CanWrite)
                    continue;

                // Try to find matching source property (case-insensitive)
                var sourceProp = sourceProperties.FirstOrDefault(sp =>
                    string.Equals(sp.Name, destProp.Name, StringComparison.OrdinalIgnoreCase));

                if (sourceProp?.CanRead == true)
                {
                    var sourceValue = sourceProp.GetValue(source);

                    if (sourceValue == null)
                    {
                        if (destProp.PropertyType.IsValueType &&
                            Nullable.GetUnderlyingType(destProp.PropertyType) == null)
                        {
                            // Don't set null to non-nullable value types
                            continue;
                        }
                        destProp.SetValue(destination, null);
                        continue;
                    }

                    var mappedValue = MapValue(sourceValue, sourceProp.PropertyType, destProp.PropertyType);
                    destProp.SetValue(destination, mappedValue);
                }
            }

            return destination;
        }

        private static object MapValue(object sourceValue, Type sourceType, Type destinationType)
        {
            if (sourceValue == null)
                return null;

            // Handle direct assignment for same types
            if (sourceType == destinationType || destinationType.IsAssignableFrom(sourceType))
            {
                return sourceValue;
            }

            // Handle nullable types
            var underlyingDestType = Nullable.GetUnderlyingType(destinationType) ?? destinationType;
            var underlyingSourceType = Nullable.GetUnderlyingType(sourceType) ?? sourceType;

            if (underlyingSourceType == underlyingDestType)
            {
                return sourceValue;
            }

            // Handle collections (List<T>, IEnumerable<T>, etc.)
            if (IsCollectionType(sourceType) && IsCollectionType(destinationType))
            {
                return MapCollection(sourceValue, sourceType, destinationType);
            }

            // Handle primitive type conversions
            if (IsPrimitiveType(underlyingDestType))
            {
                try
                {
                    return Convert.ChangeType(sourceValue, underlyingDestType);
                }
                catch
                {
                    return GetDefaultValue(destinationType);
                }
            }

            // Handle complex object mapping (nested objects)
            if (IsComplexType(underlyingDestType))
            {
                var destinationInstance = Activator.CreateInstance(underlyingDestType);
                return MapComplexObject(sourceValue, destinationInstance);
            }

            return GetDefaultValue(destinationType);
        }

        private static object MapCollection(object sourceCollection, Type sourceType, Type destinationType)
        {
            if (sourceCollection == null)
                return null;

            var sourceEnumerable = sourceCollection as IEnumerable;
            if (sourceEnumerable == null)
                return null;

            var destElementType = GetCollectionElementType(destinationType);
            var sourceElementType = GetCollectionElementType(sourceType);

            if (destElementType == null)
                return null;

            var listType = typeof(List<>).MakeGenericType(destElementType);
            var destinationList = Activator.CreateInstance(listType) as IList;

            foreach (var item in sourceEnumerable)
            {
                if (item == null)
                {
                    destinationList.Add(null);
                    continue;
                }

                var mappedItem = MapValue(item, sourceElementType ?? item.GetType(), destElementType);
                destinationList.Add(mappedItem);
            }

            // Convert to the exact destination type if needed
            if (destinationType.IsArray)
            {
                var array = Array.CreateInstance(destElementType, destinationList.Count);
                destinationList.CopyTo(array, 0);
                return array;
            }

            return destinationList;
        }

        private static object MapComplexObject(object source, object destination)
        {
            if (source == null || destination == null)
                return destination;

            var sourceType = source.GetType();
            var destinationType = destination.GetType();

            var sourceProperties = GetProperties(sourceType);
            var destinationProperties = GetProperties(destinationType);

            foreach (var destProp in destinationProperties)
            {
                if (!destProp.CanWrite)
                    continue;

                var sourceProp = sourceProperties.FirstOrDefault(sp =>
                    string.Equals(sp.Name, destProp.Name, StringComparison.OrdinalIgnoreCase));

                if (sourceProp?.CanRead == true)
                {
                    var sourceValue = sourceProp.GetValue(source);
                    var mappedValue = MapValue(sourceValue, sourceProp.PropertyType, destProp.PropertyType);
                    destProp.SetValue(destination, mappedValue);
                }
            }

            return destination;
        }

        private static PropertyInfo[] GetProperties(Type type)
        {
            var cacheKey = type.FullName;
            if (!_propertyCache.ContainsKey(cacheKey))
            {
                return type.GetProperties(BindingFlags.Public | BindingFlags.Instance);
            }

            return type.GetProperties(BindingFlags.Public | BindingFlags.Instance);
        }

        private static Type GetCollectionElementType(Type type)
        {
            if (type.IsArray)
                return type.GetElementType();

            if (type.IsGenericType)
            {
                var genericArgs = type.GetGenericArguments();
                if (genericArgs.Length == 1)
                    return genericArgs[0];
            }

            // Check if it implements IEnumerable<T>
            var enumerable = type.GetInterfaces()
                .FirstOrDefault(i => i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IEnumerable<>));

            return enumerable?.GetGenericArguments().FirstOrDefault();
        }

        private static bool IsCollectionType(Type type)
        {
            if (type == typeof(string))
                return false;

            return type.IsArray ||
                   (type.IsGenericType &&
                    (type.GetGenericTypeDefinition() == typeof(List<>) ||
                     type.GetGenericTypeDefinition() == typeof(IList<>) ||
                     type.GetGenericTypeDefinition() == typeof(ICollection<>) ||
                     type.GetGenericTypeDefinition() == typeof(IEnumerable<>))) ||
                   type.GetInterfaces().Any(i => i.IsGenericType &&
                                               i.GetGenericTypeDefinition() == typeof(IEnumerable<>));
        }

        private static bool IsPrimitiveType(Type type)
        {
            return type.IsPrimitive ||
                   type == typeof(string) ||
                   type == typeof(DateTime) ||
                   type == typeof(DateTimeOffset) ||
                   type == typeof(TimeSpan) ||
                   type == typeof(Guid) ||
                   type == typeof(decimal);
        }

        private static bool IsComplexType(Type type)
        {
            return !IsPrimitiveType(type) &&
                   !IsCollectionType(type) &&
                   type != typeof(object);
        }

        private static object GetDefaultValue(Type type)
        {
            if (type.IsValueType)
                return Activator.CreateInstance(type);
            return null;
        }
    }
}